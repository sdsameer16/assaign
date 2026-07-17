package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

var (
	apiURL     string
	numBots    int
	httpClient = &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        10000,
			MaxIdleConnsPerHost: 10000,
			IdleConnTimeout:     90 * time.Second,
		},
	}
)

type RegisterReq struct {
	MobileNumber string `json:"mobile_number"`
	ShortName    string `json:"short_name"`
	RollNumber   string `json:"roll_number"`
	Password     string `json:"password"`
	IDCardURL    string `json:"id_card_url"`
}

type OrderReq struct {
	RoomNumber string `json:"room_number"`
	Building   string `json:"building"`
	Floor      int    `json:"floor"`
	Items      []struct {
		ProductID string `json:"product_id"`
		Quantity  int    `json:"quantity"`
	} `json:"items"`
}

func main() {
	flag.StringVar(&apiURL, "url", "http://127.0.0.1:8080/api", "API Base URL")
	flag.IntVar(&numBots, "users", 5000, "Number of concurrent bots")
	flag.Parse()

	log.Printf("Starting load test with %d concurrent users against %s\n", numBots, apiURL)

	// Step 1: Login as Admin to set things up
	adminToken, err := adminLogin("admin@campusbites.com", "Admin&Ayaz786")
	if err != nil {
		log.Fatalf("Admin login failed: %v", err)
	}

	// Step 2: Register a test bot student
	botName := fmt.Sprintf("Bot_User_%d", time.Now().Unix())
	botMobile := fmt.Sprintf("999%d", time.Now().Unix()%10000000)
	botRoll := fmt.Sprintf("BOT%d", time.Now().Unix())

	studentToken, studentID, err := registerStudent(botMobile, botName, botRoll)
	if err != nil {
		log.Fatalf("Student registration failed: %v", err)
	}

	// Step 3: Admin verifies the student
	err = verifyStudent(adminToken, studentID)
	if err != nil {
		log.Fatalf("Failed to verify student: %v", err)
	}

	// Step 4: Get Menu to find a product to order, if none exist, create one.
	productID, err := getMenuProductID(studentToken)
	if err != nil {
		log.Fatalf("Failed to get product ID: %v", err)
	}
	if productID == "" {
		log.Println("No products available, creating one via Admin API...")
		productID, err = createDummyProduct(adminToken)
		if err != nil {
			log.Fatalf("Failed to create dummy product: %v", err)
		}
	}

	log.Printf("Setup complete. Student Token: %s..., Target Product: %s\n", studentToken[:10], productID)
	log.Println("Launching bots to place orders simultaneously...")

	var successCount int32
	var errorCount int32
	var totalLatency int64

	start := time.Now()
	var wg sync.WaitGroup
	
	// Create a buffered channel to limit concurrency slightly if needed, but for a true spike, we let them fly
	ready := make(chan struct{})

	for i := 0; i < numBots; i++ {
		wg.Add(1)
		go func(botID int) {
			defer wg.Done()
			<-ready // wait for the starting gun
			
			reqStart := time.Now()
			err := placeOrder(studentToken, productID)
			latency := time.Since(reqStart).Milliseconds()
			atomic.AddInt64(&totalLatency, latency)

			if err != nil {
				atomic.AddInt32(&errorCount, 1)
			} else {
				atomic.AddInt32(&successCount, 1)
			}
		}(i)
	}

	// Fire the starting gun
	close(ready)
	wg.Wait()
	duration := time.Since(start)

	log.Println("======================================")
	log.Println("        LOAD TEST RESULTS             ")
	log.Println("======================================")
	log.Printf("Total Time     : %v\n", duration)
	log.Printf("Total Requests : %d\n", numBots)
	log.Printf("Successful (2xx): %d\n", successCount)
	log.Printf("Failed (5xx/4xx): %d\n", errorCount)
	
	if numBots > 0 {
		log.Printf("Avg Latency    : %d ms\n", totalLatency/int64(numBots))
		log.Printf("Req / Sec      : %.2f\n", float64(numBots)/duration.Seconds())
	}
}

// Helpers
func adminLogin(email, pass string) (string, error) {
	body, _ := json.Marshal(map[string]string{"email": email, "password": pass})
	resp, err := httpClient.Post(apiURL+"/admin/login", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("status code: %d", resp.StatusCode)
	}
	var res map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&res)
	return res["token"].(string), nil
}

func registerStudent(mobile, name, roll string) (string, string, error) {
	body, _ := json.Marshal(RegisterReq{MobileNumber: mobile, ShortName: name, RollNumber: roll, Password: "botpass", IDCardURL: "mock_url"})
	resp, err := httpClient.Post(apiURL+"/student/register", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 201 {
		b, _ := io.ReadAll(resp.Body)
		return "", "", fmt.Errorf("status code: %d, body: %s", resp.StatusCode, string(b))
	}
	var res map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&res)
	
	// Assuming response returns student object and token
	user := res["student"].(map[string]interface{})
	return res["token"].(string), user["id"].(string), nil
}

func verifyStudent(adminToken, studentID string) error {
	req, _ := http.NewRequest("PATCH", apiURL+"/admin/students/"+studentID+"/verify", bytes.NewBufferString(`{"status":"verified"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("status code: %d", resp.StatusCode)
	}
	return nil
}

func getMenuProductID(token string) (string, error) {
	req, _ := http.NewRequest("GET", apiURL+"/student/menu", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("status code: %d", resp.StatusCode)
	}
	
	var menuRes struct {
		Products []struct {
			ID          string  `json:"id"`
			IsAvailable bool    `json:"is_available"`
		} `json:"products"`
	}
	json.NewDecoder(resp.Body).Decode(&menuRes)
	
	for _, p := range menuRes.Products {
		if p.IsAvailable {
			return p.ID, nil
		}
	}
	return "", nil
}

func placeOrder(token, productID string) error {
	order := OrderReq{
		RoomNumber: "B-212",
		Building:   "Boys Hostel 1",
		Floor:      2,
	}
	order.Items = append(order.Items, struct{
		ProductID string `json:"product_id"`
		Quantity  int    `json:"quantity"`
	}{ProductID: productID, Quantity: 1})

	body, _ := json.Marshal(order)
	req, _ := http.NewRequest("POST", apiURL+"/student/orders", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 201 && resp.StatusCode != 202 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("status code: %d, %s", resp.StatusCode, string(b))
	}
	return nil
}

func createDummyProduct(adminToken string) (string, error) {
	catReq := "{\"name\":\"Load Test Category\"}"
	req, _ := http.NewRequest("POST", apiURL+"/admin/categories", bytes.NewBufferString(catReq))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, err := httpClient.Do(req)
	if err != nil { return "", err }
	defer resp.Body.Close()
	if resp.StatusCode != 201 { b, _ := io.ReadAll(resp.Body); return "", fmt.Errorf("failed category: %s", string(b)) }
	var catRes map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&catRes)
	catID := catRes["id"].(string)

	prodReq := fmt.Sprintf("{\"name\":\"Load Test Burger\",\"category_id\":\"%s\",\"mrp\":100.00,\"selling_price\":80.00,\"image_url\":\"mock\"}", catID)
	req2, _ := http.NewRequest("POST", apiURL+"/admin/products", bytes.NewBufferString(prodReq))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", "Bearer "+adminToken)
	resp2, err := httpClient.Do(req2)
	if err != nil { return "", err }
	defer resp2.Body.Close()
	if resp2.StatusCode != 201 { b, _ := io.ReadAll(resp2.Body); return "", fmt.Errorf("failed product: %s", string(b)) }
	var prodRes map[string]interface{}
	json.NewDecoder(resp2.Body).Decode(&prodRes)
	return prodRes["id"].(string), nil
}
