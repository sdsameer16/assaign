package services

import (
	"context"
	"fmt"
	"log"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
)

type FCMService struct {
	app    *firebase.App
	client *messaging.Client
}

// NewFCMService initializes the Firebase Cloud Messaging client.
func NewFCMService(credentialsFile string, credentialsJSON string) (*FCMService, error) {
	ctx := context.Background()
	var app *firebase.App
	var err error

	if credentialsJSON != "" {
		opt := option.WithCredentialsJSON([]byte(credentialsJSON))
		app, err = firebase.NewApp(ctx, nil, opt)
	} else if credentialsFile != "" {
		opt := option.WithCredentialsFile(credentialsFile)
		app, err = firebase.NewApp(ctx, nil, opt)
	} else {
		// Attempt to use default credentials (useful if running on GCP or if GOOGLE_APPLICATION_CREDENTIALS is set)
		app, err = firebase.NewApp(ctx, nil)
	}

	if err != nil {
		return nil, fmt.Errorf("error initializing firebase app: %v", err)
	}

	client, err := app.Messaging(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting Messaging client: %v", err)
	}

	return &FCMService{
		app:    app,
		client: client,
	}, nil
}

// SendToUser sends a push notification to a specific device token.
func (f *FCMService) SendToUser(ctx context.Context, token, title, body string) error {
	if f.client == nil || token == "" {
		return nil
	}

	message := &messaging.Message{
		Notification: &messaging.Notification{
			Title: title,
			Body:  body,
		},
		Token: token,
	}

	response, err := f.client.Send(ctx, message)
	if err != nil {
		log.Printf("Failure sending FCM message to token %s: %v", token, err)
		return err
	}
	log.Printf("Successfully sent FCM message: %v", response)
	return nil
}

// SendToTokens sends a multicast message to multiple tokens.
func (f *FCMService) SendToTokens(ctx context.Context, tokens []string, title, body string) error {
	if f.client == nil || len(tokens) == 0 {
		return nil
	}

	// FCM Multicast allows up to 500 tokens per call.
	// For production, you might need to chunk this array.
	message := &messaging.MulticastMessage{
		Notification: &messaging.Notification{
			Title: title,
			Body:  body,
		},
		Tokens: tokens,
	}

	response, err := f.client.SendEachForMulticast(ctx, message)
	if err != nil {
		log.Printf("Failure sending FCM multicast: %v", err)
		return err
	}
	log.Printf("Successfully sent FCM multicast message to %d devices. Failures: %d", response.SuccessCount, response.FailureCount)
	return nil
}
