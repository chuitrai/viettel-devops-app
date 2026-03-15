package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"golang.org/x/time/rate"
)

// Cấu trúc JSON của Google Cloud Pub/Sub Push Notification
type PubSubMessage struct {
	Message struct {
		Data       string            `json:"data"`
		MessageID  string            `json:"messageId"`
		Attributes map[string]string `json:"attributes"`
	} `json:"message"`
	Subscription string `json:"subscription"`
}

// -------------------------------------------------------------
// [LOGGING/EFK] Middleware tự động xuất log chuẩn cho Fluentd
// -------------------------------------------------------------
func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		latency := time.Since(start)

		log.Printf("path=%s method=%s status=%d latency=%v",
			c.Request.URL.Path,
			c.Request.Method,
			c.Writer.Status(),
			latency,
		)
	}
}

// -------------------------------------------------------------
// [SECURITY 3] Rate Limiting - Chống DDoS/Spam (>10 req/min -> 409)
// -------------------------------------------------------------
// Limit(10.0/60.0) tương đương 10 lượt request mỗi 60 giây. Cỡ thùng (burst) = 10.
var globalLimiter = rate.NewLimiter(rate.Limit(10.0/60.0), 10)

func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !globalLimiter.Allow() {
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{
				"error":   "Rate limit exceeded",
				"message": "Too many requests. Allowed max 10 requests per minute.",
				"status":  409,
			})
			return
		}
		c.Next()
	}
}

// -------------------------------------------------------------
// [SECURITY 2] Authentication & Authorization (Phân quyền)
// -------------------------------------------------------------
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Bỏ qua chốt an ninh cho các cổng nội bộ/giám sát
		if c.Request.URL.Path == "/metrics" || c.Request.URL.Path == "/health" {
			c.Next()
			return
		}

		// Yêu cầu phải truyền Header X-Role để định danh
		role := c.GetHeader("X-Role")
		if role == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden", "message": "Missing 'X-Role' header"})
			return
		}

		// Áp dụng luật phân quyền User vs Admin
		if role == "user" {
			if c.Request.Method != http.MethodGet {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden", "message": "Role 'user' is only allowed to perform GET requests"})
				return
			}
		} else if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden", "message": "Invalid Role"})
			return
		}

		// Admin được pass qua mọi method (GET, POST, DELETE)
		c.Next()
	}
}

func main() {
	// Khởi tạo router của Gin (tắt built-in logger để dùng cái custom của ta)
	r := gin.New()
	r.Use(gin.Recovery())

	// 1. Áp dụng Logging Middleware
	r.Use(LoggerMiddleware())
	// 2. Áp dụng Rate Limit Middleware (409)
	r.Use(RateLimitMiddleware())
	// 3. Áp dụng Security/Auth Middleware (403)
	r.Use(AuthMiddleware())

	// -------------------------------------------------------------
	// [MONITORING] Kênh /metrics để Prometheus quét số liệu
	// -------------------------------------------------------------
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	r.GET("/health", func(c *gin.Context) {
		c.String(http.StatusOK, "OK")
	})

	r.GET("/", func(c *gin.Context) {
		appName := os.Getenv("APP_NAME")
		if appName == "" {
			appName = "Viettel Golang Microservice"
		}
		env := os.Getenv("ENVIRONMENT")
		msg := fmt.Sprintf("🚀 Hello DevOps! Xin chao tu [%s] dang chay trong moi truong [%s]! Phien ban Security.\n", appName, env)
		c.String(http.StatusOK, msg)
	})

	r.POST("/test", func(c *gin.Context) {
		var pubsubMsg PubSubMessage
		if err := c.ShouldBindJSON(&pubsubMsg); err == nil && pubsubMsg.Message.MessageID != "" {
			log.Printf("🔔 [GMAIL TRIGGER] Nhận được thông báo từ Pub/Sub! MessageID: %s\n", pubsubMsg.Message.MessageID)
		} else {
			log.Println("✅ Nhận được request POST bình thường vào /test")
		}

		c.JSON(http.StatusOK, gin.H{
			"message":   "Testing Oke! API POST da hoat dong (Duoi quyen Admin).",
			"status":    "Success",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})

	r.DELETE("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Da DELETE du lieu thanh cong (Duoi quyen Admin).",
			"status":  "Success",
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting Security Gin Server on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
