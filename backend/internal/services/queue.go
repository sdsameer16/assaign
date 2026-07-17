package services

import (
	"context"
	"fmt"
	"log"
	"time"
	"math/rand"

	"campusbites/backend/internal/database"
	"campusbites/backend/internal/models"
)

type OrderTask struct {
	StudentID           string
	RoomNumber          string
	Building            string
	Floor               int
	SpecialInstructions string
	Items               []models.OrderItem
}

type OrderQueue struct {
	tasks          chan OrderTask
	db             *database.DB
	paymentService *PaymentService
}

func NewOrderQueue(bufferSize int, db *database.DB, ps *PaymentService) *OrderQueue {
	return &OrderQueue{
		tasks:          make(chan OrderTask, bufferSize),
		db:             db,
		paymentService: ps,
	}
}

func (q *OrderQueue) Push(task OrderTask) error {
	select {
	case q.tasks <- task:
		return nil
	default:
		return fmt.Errorf("queue is full")
	}
}

func (q *OrderQueue) StartWorkers(workerCount int) {
	for i := 0; i < workerCount; i++ {
		go q.worker(i)
	}
	log.Printf("Started %d order processing workers", workerCount)
}

func (q *OrderQueue) worker(id int) {
	for task := range q.tasks {
		err := q.processOrder(task)
		if err != nil {
			log.Printf("[Worker %d] Failed to process queued order for student %s: %v", id, task.StudentID, err)
		} else {
			log.Printf("[Worker %d] Successfully processed order for student %s", id, task.StudentID)
		}
	}
}

func (q *OrderQueue) processOrder(task OrderTask) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tx, err := q.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("transaction begin failed: %w", err)
	}
	defer tx.Rollback(ctx)

	var totalAmount float64
	type ProductInfo struct {
		Price float64
		Name  string
	}
	productDetails := make(map[string]ProductInfo)

	for _, item := range task.Items {
		var price float64
		var name string
		var isAvailable bool
		err = tx.QueryRow(ctx, `SELECT name, selling_price, is_available FROM products WHERE id = $1`, item.ProductID).Scan(&name, &price, &isAvailable)
		if err != nil {
			return fmt.Errorf("product not found: %s", item.ProductID)
		}
		if !isAvailable {
			return fmt.Errorf("product out of stock: %s", name)
		}
		totalAmount += price * float64(item.Quantity)
		productDetails[item.ProductID] = ProductInfo{Price: price, Name: name}
	}

	rand.Seed(time.Now().UnixNano())
	orderNum := fmt.Sprintf("CB-%d-%d", time.Now().Unix()%100000, rand.Intn(900)+100)

	var orderID string
	insertOrder := `
		INSERT INTO orders (order_number, student_id, room_number, building, floor, total_amount, status, special_instructions)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`
	err = tx.QueryRow(ctx, insertOrder, orderNum, task.StudentID, task.RoomNumber, task.Building, task.Floor, totalAmount, models.OrderStatusReceived, task.SpecialInstructions).Scan(&orderID)
	if err != nil {
		return fmt.Errorf("failed to save order header: %w", err)
	}

	for _, item := range task.Items {
		insertItem := `
			INSERT INTO order_items (order_id, product_id, quantity, unit_price)
			VALUES ($1, $2, $3, $4)
		`
		_, err = tx.Exec(ctx, insertItem, orderID, item.ProductID, item.Quantity, productDetails[item.ProductID].Price)
		if err != nil {
			return fmt.Errorf("failed to save items: %w", err)
		}
	}

	insertHistory := `
		INSERT INTO order_status_history (order_id, status, changed_by, changed_at)
		VALUES ($1, $2, $3, $4)
	`
	_, err = tx.Exec(ctx, insertHistory, orderID, models.OrderStatusReceived, task.StudentID, time.Now())
	if err != nil {
		return fmt.Errorf("failed to save history: %w", err)
	}

	rzpOrderID, err := q.paymentService.CreateRazorpayOrder(totalAmount)
	if err != nil {
		return fmt.Errorf("razorpay creation failed: %w", err)
	}

	insertPayment := `
		INSERT INTO payments (order_id, razorpay_order_id, amount, status)
		VALUES ($1, $2, $3, $4)
	`
	_, err = tx.Exec(ctx, insertPayment, orderID, rzpOrderID, totalAmount, models.PaymentStatusCreated)
	if err != nil {
		return fmt.Errorf("failed to save payment record: %w", err)
	}

	_, err = tx.Exec(ctx, `UPDATE students SET last_room_number = $1 WHERE id = $2`, task.RoomNumber, task.StudentID)
	if err != nil {
		return fmt.Errorf("failed to update room number: %w", err)
	}

	return tx.Commit(ctx)
}
