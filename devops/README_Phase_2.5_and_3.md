# Hướng dẫn chi tiết Giai đoạn 2.5 và Giai đoạn 3

Tài liệu này lưu trữ lại toàn bộ các câu lệnh và giải thích chi tiết cho Giai đoạn 2.5 (Tối ưu Kubernetes) và Giai đoạn 3 (Cài đặt hệ thống CI/CD lõi: Jenkins & ArgoCD).

**Lưu ý quan trọng:** Toàn bộ các lệnh dưới đây đều được thực thi trên máy **K8s-Master**. Bạn kết nối vào máy master bằng lệnh: `vagrant ssh master`.

---

## 🛠️ Phase 2.5: Cấu hình Chiều Sâu (Production-Ready K8s)

Sau khi dựng cụm bằng `kubeadm`, K8s vẫn là một "cái vỏ rỗng" thiếu các công cụ quản lý cơ bản. Chúng ta cần bổ sung 3 vũ khí sau:

### 1. StorageClass (Bộ cấp phát ổ cứng tự động)
**Vấn đề:** Các ứng dụng Stateful (như Jenkins, Database) cần nơi lưu dữ liệu. Nếu không có StorageClass, khi xin ổ cứng (PVC), hệ thống sẽ bị treo.
**Giải pháp:** Cài `Local Path Provisioner` để tự động lấy dung lượng trống trên máy ảo cấp cho ứng dụng.

```bash
# 1. Cài đặt Local Path Provisioner
kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.28/deploy/local-path-storage.yaml

# 2. Cấu hình nó thành bộ cấp phát mặc định cho toàn cụm K8s
kubectl patch storageclass local-path -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'

# 3. Kiểm tra kết quả (Phải hiện chữ "local-path (default)")
kubectl get sc
```

### 2. Helm (Trình quản lý gói ứng dụng cho K8s)
**Vấn đề:** Triển khai ứng dụng phức tạp (như Jenkins) cần hàng chục cấu hình YAML.
**Giải pháp:** Dùng Helm (như lệnh `apt` của Ubuntu) để đóng gói và cài đặt ứng dụng chỉ qua 1 dòng lệnh.

```bash
# Tải và cài đặt Helm v3
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh

# Kiểm tra version
helm version
```

### 3. Metrics Server (Cảm biến đo lường phần cứng)
**Vấn đề:** K8s không biết các Node/Pod đang ăn bao nhiêu RAM/CPU, làm tê liệt tính năng tự động scale.
**Giải pháp:** Cài Metrics Server kèm cờ bỏ qua SSL nội bộ để thu thập số liệu Real-time.

```bash
# 1. Tải file cấu hình cài đặt
wget https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml -O metrics-server.yaml

# 2. Sửa cấu hình: Ép bỏ qua check TLS (Do mình dùng SSL tự cấp)
sed -i '/- args:/a \        - --kubelet-insecure-tls' metrics-server.yaml

# 3. Apply lên cụm
kubectl apply -f metrics-server.yaml

# 4. Kiểm tra sức khoẻ (Đợi khoảng 1-2 phút mới có số liệu)
kubectl top nodes
```

---

## 🚀 Phase 3: Triển khai GitOps & CI/CD Core

### 1. Cài đặt ArgoCD (The GitOps Operator)
Siêu giám sát liên tục so sánh trạng thái ứng dụng trên K8s với file cấu hình lưu trên Github, và tự động đồng bộ (deploy) nhanh chóng.

```bash
# 1. Tạo môi trường độc lập (Namespace)
kubectl create namespace argocd

# 2. Cài đặt ArgoCD bản stable qua file Manifest gốc của hãng (Sử dụng cờ ép cài đặt do file cấu hình lớn)
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml --server-side --force-conflicts

# 3. Giám sát tiến độ cài đặt (Đợi đến khi tất cả các Pod đổi sang trạng thái 'Running')
kubectl get pods -n argocd -w
```

### 2. Cài đặt Jenkins (CI Server)
Robot chịu trách nhiệm kéo gốc code, build (biên dịch), test và đẩy ảnh Docker lên kho chứa. Ở đây thao tác siêu tốc thông qua Helm.

```bash
# 1. Khai báo kho chứa mã nguồn Jenkins cho Helm
helm repo add jenkins https://charts.jenkins.io
helm repo update

# 2. Tạo môi trường độc lập (Namespace) 
kubectl create namespace jenkins

# 3. Cài đặt công phu bằng 1 lệnh Helm (Tải & Chạy)
helm install my-jenkins jenkins/jenkins --namespace jenkins

# 4. Giám sát tiến độ cài đặt
kubectl get pods -n jenkins -w
```
*(Ghi chú: Quá trình tải và khởi động Jenkins có thể mất tới 5-10 phút do nó sử dụng StorageClass để sinh cấp ổ đĩa).*

### 3. Lấy Mật khẩu Quản trị Hệ Thống (Admin Passwords)
Hệ thống Jenkins và ArgoCD đều sinh mật khẩu ngẫu nhiên trong lần đầu tạo. Lưu lại 2 mật khẩu này để lát sử dụng UI đăng nhập.

```bash
# Lấy Password của Jenkins (Username mặc định: admin)
kubectl get secret --namespace jenkins my-jenkins -o jsonpath="{.data.jenkins-admin-password}" | base64 --decode && echo

# Lấy Password của ArgoCD (Username mặc định: admin)
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo
```

### 4. Mở Cổng Dịch Vụ (NodePort) để truy cập giao diện Web Browser
Mặc định, K8s giấu kín Jenkins và ArgoCD ở mạng nội bộ (ClusterIP). Để truy cập được từ máy tính Windows bên ngoài, ta phải "đục lỗ" tường lửa bằng cách chuyển kiểu Service sang `NodePort` và ép K8s mở một cổng tĩnh cố định.

```bash
# 1. Ép mở cổng 32000 cho Jenkins
kubectl patch svc my-jenkins -n jenkins --type json -p '[
  {"op": "replace", "path": "/spec/type", "value": "NodePort"},
  {"op": "replace", "path": "/spec/ports/0/nodePort", "value": 32000}
]'

# 2. Ép mở cổng 32001 (HTTP) và 32002 (HTTPS) cho ArgoCD
kubectl patch svc argocd-server -n argocd --type json -p '[
  {"op": "replace", "path": "/spec/type", "value": "NodePort"},
  {"op": "replace", "path": "/spec/ports/0/nodePort", "value": 32001},
  {"op": "replace", "path": "/spec/ports/1/nodePort", "value": 32002}
]'
```

**Truy cập trên Trình Duyệt Web:**
- **URL của Jenkins:** `http://<IP-MÁY-ẢO>:32000` (Ví dụ: `http://192.168.56.10:32000` hoặc `http://192.168.56.11:32000`)
- **URL của ArgoCD:** `https://<IP-MÁY-ẢO>:32002` (Chú ý phải dùng `https://` và đồng ý cảnh báo bảo mật)

> 💡 **Kiến thức K8s: Tại sao có thể mở web bằng IP của máy Worker (192.168.56.11) thay vì máy Master (192.168.56.10)?**
> Bản chất của kiểu mạng lưới **NodePort** trong K8s là khái niệm "Cổng mở toàn cục". Khi bạn ban hành lệnh tạo NodePort (ví dụ cổng 32000), ông bảo vệ *Kube-proxy* sẽ lập tức chạy đi mở toang cổng 32000 trên **tất cả** các máy ảo đang có trong Cụm (Bao gồm cả Master và mọi Worker Node). 
> Dù bản thân cái Pod Jenkins đang nằm vật lý ở máy Master hay máy Worker, Kube-proxy cũng tự lập một bản đồ định tuyến ngầm. Nếu bạn gõ IP máy Worker, Worker Node sẽ hứng Traffic, xem xét bản đồ, và nhận ra *"À cái Jenkins này đang nằm ở Master"*, nó sẽ tự động làm thao tác bế gói tin Network (NAT) quăng ngược lại sang máy Master cho bạn. Do đó, với K8s, **bạn dùng IP của máy nào trong luồng mạng cũng đều ra kết quả giống hệt nhau!**
