# VDT Store - DevOps Practice App

Ứng dụng này được thiết kế để thực hành CI/CD, Monitoring, Logging và Security cho dự án Viettel Digital Talent 2025.

## 1. Chạy dưới Local

### Yêu cầu
- Node.js 20+
- npm

### Các bước thực hiện
1. **Tải mã nguồn:** (Copy các file từ môi trường này về máy của bạn).
2. **Cài đặt dependencies:**
   ```bash
   npm install
   ```
3. **Chạy ở chế độ Development:**
   ```bash
   npm run dev
   ```
   Ứng dụng sẽ chạy tại: `http://localhost:3000`

4. **Build và chạy Production:**
   ```bash
   npm run build
   node server.ts
   ```

---

## 2. Triển khai với ArgoCD (Kubernetes)

Để "quăng" ứng dụng này lên ArgoCD, bạn cần thực hiện các bước sau:

### Bước 1: Build và Push Docker Image
1. Build image:
   ```bash
   docker build -t <your-username>/vdt-store:v1.0.0 .
   ```
2. Push lên Docker Hub:
   ```bash
   docker push <your-username>/vdt-store:v1.0.0
   ```

### Bước 2: Cấu hình Manifest Repo
1. Tạo một repository trên GitHub (ví dụ: `vdt-2025-config`).
2. Copy file `k8s/app-deploy.yaml` vào repo đó.
3. Cập nhật `image` trong file yaml thành image bạn vừa push.

### Bước 3: Tạo Application trên ArgoCD
Sử dụng giao diện ArgoCD hoặc CLI để tạo app:
- **Project:** `default`
- **Source Repo URL:** Link repo config của bạn.
- **Path:** `.` (hoặc folder chứa file yaml).
- **Cluster URL:** `https://kubernetes.default.svc`
- **Namespace:** `default` (hoặc namespace bạn chọn).

---

## 3. Các điểm lưu ý cho DevOps
- **Monitoring:** Prometheus sẽ tự động scrape metrics tại `/metrics` nhờ các `annotations` trong file deployment.
- **Logging:** Container logs sẽ xuất ra định dạng JSON, bạn chỉ cần cấu hình Fluentd để parse các log này.
- **CI/CD:** Bạn có thể dùng Jenkins để tự động hóa việc build image và update tag vào repo config khi có code mới.
