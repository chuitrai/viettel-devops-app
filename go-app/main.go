package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

type TestResponse struct {
	Message   string `json:"message"`
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
}

// Cấu trúc JSON của Google Cloud Pub/Sub Push Notification
type PubSubMessage struct {
	Message struct {
		Data       string            `json:"data"`
		MessageID  string            `json:"messageId"`
		Attributes map[string]string `json:"attributes"`
	} `json:"message"`
	Subscription string `json:"subscription"`
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	appName := os.Getenv("APP_NAME")
	if appName == "" {
		appName = "Viettel Golang Microservice"
	}
	env := os.Getenv("ENVIRONMENT")
	msg := fmt.Sprintf("🚀 Hello DevOps! Xin chao tu [%s] dang chay trong moi truong [%s]!\n", appName, env)
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(msg))
}

func testHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed. Please use POST", http.StatusMethodNotAllowed)
		return
	}

	// Cố gắng đọc Body xem có phải là từ Google Pub/Sub gửi tới không
	var pubsubMsg PubSubMessage
	if err := json.NewDecoder(r.Body).Decode(&pubsubMsg); err == nil && pubsubMsg.Message.MessageID != "" {
		log.Printf("🔔 [GMAIL TRIGGER] Nhận được thông báo từ Pub/Sub! MessageID: %s\n", pubsubMsg.Message.MessageID)
	} else {
		log.Println("✅ Nhận được request POST bình thường vào /test")
	}

	resp := TestResponse{
		Message:   "Testing Oke! API POST da hoat dong.",
		Status:    "Success",
		Timestamp: time.Now().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

func main() {
	http.HandleFunc("/", rootHandler)
	http.HandleFunc("/test", testHandler)
	http.HandleFunc("/health", healthHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server is starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
