package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

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

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

func main() {
	http.HandleFunc("/", rootHandler)
	http.HandleFunc("/health", healthHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server is starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
