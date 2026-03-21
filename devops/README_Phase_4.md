# Phase 4: Monitoring, Logging, và Security

Tài liệu này hướng dẫn chi tiết các bước triển khai nền tảng Giám sát (Monitoring), Lưu vết (Logging) và Bảo mật (Security) cho hệ thống Kubernetes và ứng dụng Golang, tuân thủ đúng kiến trúc DevOps cấp độ Production.

## Mục tiêu của Phase 4

1. **Monitoring (Giám sát hệ thống)**
   - Ứng dụng Golang sẽ xuất các số liệu (metrics) qua đường dẫn `/metrics` bằng thư viện Prometheus Client.
   - Sử dụng **Ansible** để tự động hóa việc cài đặt **Prometheus**.
   - Cấu hình Prometheus tự động thu thập (scrape) số liệu từ ứng dụng Go.

2. **Logging (Quản lý Log tập trung)**
   - Ứng dụng Golang ghi log chuẩn hóa các thông số: `path`, `method`, `status`, và `latency`.
   - Sử dụng **Ansible** để triển khai mô hình **EFK Stack** (Elasticsearch, Fluentd, Kibana).
   - Truy xuất và tìm kiếm lỗi API thực tế trên giao diện Kibana.

3. **Security (Bảo mật tầng mạng & ứng dụng)**
   - **Load Balancer:** Chạy **HAProxy** điều hướng TCP Traffic vào K8s NodePort.
   - **Ingress & HTTPS:** Triển khai **Nginx Ingress Controller** cùng chứng chỉ SSL tự cấp (Self-signed) để mã hóa đường truyền.
   - **Authentication/Authorization:** Tích hợp Middleware trên ứng dụng để kiểm soát quyền (Role-based): `user` (chỉ GET) và `admin` (toàn quyền).
   - **Rate Limiting:** Tích hợp bộ đếm giới hạn số lượng request (< 10 requests / phút) chống spam/DDoS, trả về mã lỗi HTTP 409 khi quá tải.

---

## Chuẩn bị cấu trúc thư mục

Để dễ quản lý toàn bộ cấu hình hạ tầng cho Phase 4, chúng ta sẽ tạo thêm các thư mục sau vào dự án:

```text
ViettelProject/
├── ansible/
│   ├── install_prometheus.yml
│   ├── install_efk.yml
│   └── hosts
├── go-app/
│   ├── main.go (Cập nhật Gin + Metrics + ELK log format + Auth + Limit)
│   └── go.mod
└── k8s-security/
    ├── haproxy/
    └── ingress/
```

Các bước chi tiết (Cập nhật Code, Chạy Ansible, Test Security) sẽ được bổ sung chi tiết ở các phần bên dưới sau khi hệ thống Code hoàn tất!!

