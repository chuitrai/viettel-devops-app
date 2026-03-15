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

### 5. Thực thi Triển khai Ứng dụng (Deploy App) bằng Jenkins và ArgoCD

Sau khi đã cung cấp cơ sở hạ tầng, tài liệu này hướng dẫn bạn cấu hình hai công cụ lõi là Jenkins (để build code/Docker image) và ArgoCD (để đồng bộ mã máy vào cụm K8s).

#### Bước 5.1: Cấu hình Jenkins (Continuous Integration - CI)
Jenkins sẽ chạy thư mục `Jenkinsfile` tạo sẵn để tự động checkout code, build ảnh Docker rồi đẩy lên repo Github của ta.

1. **Khởi tạo Credentials (Mật khẩu tài khoản)**
   - Đăng nhập Jenkins UI ở `http://192.168.56.10:32000` với user `admin`.
   - Vào **Dashboard** > **Manage Jenkins** > **Credentials** > **System** > **Global credentials** > **Add Credentials**.
   - Tạo Credential 1 (Sử dụng đăng nhập Docker Hub):
     - Kind: "Username with password"
     - Username: Tài khoản Docker Hub của bạn (VD: `chuitrai2901`).
     - Password: Mật khẩu (Hoặc Docker Access Token).
     - ID: `dockerhub-creds` *(Bắt buộc phải gõ đúng tên này theo config Jenkinsfile)*.
   - Tạo Credential 2 (Sử dụng cập nhật source code từ Git):
     - Kind: "Username with password"
     - Username: Github Username (VD: `chuitrai`).
     - Password: Personal Access Token (PAT) của Github với quyền `repo` và `admin`.
     - ID: `github-creds` *(Bắt buộc theo config Jenkinsfile)*.

2. **Chạy Pipeline Job (Build mã nguồn)**
   - Về **Dashboard** > Bấm **New Item** > Tên `vdt-go-app` > Chọn loại **Pipeline**. Nhấn OK.
   - SCM Definition: Kéo xuống mục Pipeline, Definition chọn **Pipeline script from SCM**.
   - SCM: Chọn **Git**.
   - Repository URL: Điền repo dự án của bạn (ví dụ: `https://github.com/chuitrai/viettel-devops-app.git`).
   - Repository Credentials: Có thể chọn Add credential git để clone code pipeline (Nếu repo Git riêng tư).
   - Branch Identifier: gõ `*/main`.
   - Script Path: Gõ `Jenkinsfile`.
   - Lưu lại (**Save**). Sau đó ấn **Build Now**. Jenkins sẽ tự mượn K8s tạo pod container Docker để build, đẩy image `vdt-go-app` lên DockerHub và commit cập nhật thẻ (tag image) vào thư mục `go-app/helm-chart/values.yaml` trên Github.

#### Bước 5.2: Cấu hình ArgoCD (Continuous Deployment - CD)
Khi `values.yaml` đã được Jenkins đẩy version mới nhất lên Github, ArgoCD sẽ phát hiện sự chênh lệch (GitOps Sync) và cập nhật ứng dụng tự động.

1. **Thêm Repository chứa Application**
   - Đăng nhập giao diện ArgoCD `https://192.168.56.10:32002` bằng HTTPS (có ssl unsafe flag).
   - Chọn Sidebar > **Settings** > **Repositories** > Nhấn **+ CONNECT REPO**.
   - Method: HTTPS
   - Repository URL: Repo dự án (Vd: `https://github.com/chuitrai/viettel-devops-app.git`).
   - Cung cấp Github username và PAT cho phần mềm tải code. Bấm Connect và Status phải là "Successful".

2. **Tạo Project Ứng Dụng (Application)**
   - Giao diện góc trái, bấm sang Tab **Applications** > Nhấn **+ NEW APP**.
   - **General:**
     - Application Name: `vdt-go-app`
     - Project: `default`
     - Sync Policy: `Automatic` (tích luôn vào mục `Prune resources` và `Self Heal` để Argo tự động xóa Pod rác và đảm bảo state mong muốn).
   - **Source:**
     - Repository URL: `https://github.com/chuitrai/viettel-devops-app.git`
     - Revision: `HEAD`.
     - Path: `go-app/helm-chart` *(ArgoCD sẽ tự nhận diện đây là nguồn cấp Helm Chart).*
   - **Destination:**
     - Cluster URL: `https://kubernetes.default.svc`
     - Namespace: Gõ `default` hoặc một Namespace tuỳ chọn do bạn đã định khung bên file k8s.
   - Cuối cùng, nhấn chọn nút **CREATE** phía trên.
   
3. **Giám sát sự đồng bộ (GitOps Tracker)**
   - Trở lại dashboard ứng dụng của ArgoCD, bạn sẽ thấy nó đang Spin-up các StatefulSet, Pod, Service cho đúng như trong Git. Khi mọi khối chuyển sang màu xanh (Sync OK / Healthy), ứng dụng đã được deploy thành công lên hệ thống K8s của bạn!

#### Bước 5.3: Kiểm tra toàn diện hệ thống (End-to-End Check)
Đây là cách để bạn xác minh rằng luồng công việc tự động (GitOps) đã chạy trơn tru từ đầu đến cuối:

1. **Kiểm tra mặt trận CI (Jenkins & DockerHub):**
   - Mở Jenkins UI (`http://192.168.56.10:32000`). Bấm vào Job `vdt-go-app`.
   - Một tiến trình Build thành công sẽ có màu Xanh Lá (Success). Bấm vào tab **Console Output** để xem log Kaniko đóng gói và ném image thành công.
   - Truy cập trang cá nhân Docker Hub của bạn, kiểm tra kho chứa ảnh (`chuitrai2901/vdt-go-app`). Bạn sẽ thấy nhãn Version (Tag) mới nhất vừa được đẩy lên trùng khớp với số Build của Jenkins.

2. **Kiểm tra mặt trận CD (ArgoCD & Github):**
   - Mở Github, vào file `go-app/helm-chart/values.yaml`. Bạn phải thấy dòng chữ `tag: "[Số-Build]"` đã tự động được nhảy số (Commit do Jenkins trigger).
   - Mở ArgoCD UI (`https://192.168.56.10:32002`). Mục Application `vdt-go-app` phải báo "Synced" kèm theo trái tim "Healthy" màu xanh lá.
   - Nhấp vào ứng dụng trong ArgoCD, bạn sẽ thấy nó đã tự động vẽ sơ đồ khởi tạo lại các khối Pods với cái thẻ Image đời mới nhất.

3. **Log vào App (Kiểm tra thực tế tính năng):**
   - Ứng dụng Go App của bạn trong bài Lab đã được thiết kế một dịch vụ phơi ra ngoài K8s ở cổng (Port) **`32005`** (NodePort khai báo trong Helm).
   - Truy cập ứng dụng lên trình duyệt bằng đường dẫn: **`http://192.168.56.10:32005`** hoặc **`http://192.168.56.11:32005`**
   - Màn hình sẽ hiển thị cấu trúc nội dung mà bạn lập trình bằng ngôn ngữ Go. Mỗi khi bạn thay code Go và đẩy lên nhánh `main`, 5 phút sau URL này sẽ tự động ra diện mạo mới do ArgoCD kéo về!

---
## 🛑 Khắc phục lỗi thường gặp (Troubleshooting)

### 1. Kiến trúc Build Image Native không dùng Docker (Kaniko)
**Vấn đề cũ:** Trong các hướng dẫn CI/CD truyền thống, Jenkins thường sử dụng một container `docker:dind` (Docker-in-Docker) hoặc xin mount socket `/var/run/docker.sock` từ máy chủ (Host) để thu thập khả năng đóng gói Image. Tuy nhiên, kể từ bản K8s v1.24+, Docker đã bị loại bỏ hoàn toàn để nhường sân cho `containerd`. Việc cố tình chạy lõi Docker sinh ra các lỗi xung đột như `Cannot connect to the Docker daemon`.

**Giải pháp chuẩn DevOps:** 
Trong file `Jenkinsfile` đi kèm của Repository này, kiến trúc đã được nâng cấp lên dùng **Kaniko** (`gcr.io/kaniko-project/executor`).
- Kaniko build trực tiếp cấu trúc Dockerfile thành ảnh Container bên trong không gian người dùng (userspace).
- Tuyệt đối KHÔNG cần quyền `privileged` rủi ro bảo mật.
- Tuyệt đối KHÔNG phụ thuộc vào việc máy chủ vật lý bên ngoài (Master/Worker) có cài đặt phần mềm Docker hay không.
- Cơ chế đẩy (Push) được cấu hình trưc tiếp bằng việc tự động tạo file xác thực `/kaniko/.docker/config.json`. Mọi thứ độc lập và Cloud-Native 100%. Môi trường của bạn luôn sạch sẽ!

### 2. Quản lý trạng thái Vagrant an toàn (Nghỉ ngơi / Tạm dừng)
Nếu bạn cần đi ngủ, **TUYỆT ĐỐI KHÔNG tắt nóng màn hình hay ép Shutdown** vì điều này có thể phá nát mạng nội bộ của Cụm máy ảo Kubernetes. Luôn đứng ở Terminal ngoài Windows (thư mục `devops/vagrant/`) và chạy:

- Dành cho Ngủ đông (Bảo toàn RAM - Nhanh): `vagrant suspend`.
- Dành cho Tắt hẳn (Giải phóng RAM - Xoá sạch): `vagrant halt`.
- Khởi động lại sáng hôm sau: `vagrant up`.

### 3. Lỗi Lấy Số Liệu `kubectl top nodes`: `error: Metrics API not available`
**Nguyên nhân:**
Quá trình cài đặt Metrics Server ban đầu thành công, nhưng K8s API không thể lấy được số liệu do **Plugin Flannel** và con robot **Kubelet** bị K8s tự động ép ăn theo card mạng mặc định NAT `eth0` (địa chỉ 10.0.2.15). Do thiết kế của máy ảo kiến trúc Vagrant, đường hầm mạng Host-Only thực chất nằm ở card thứ hai (điển hình là **`enp0s8`** hoặc `eth1` tuỳ phiên bản Linux). Việc này làm Metrics Server không kiếm thấy máy để lấy số liệu.

**Cách khắc phục:**
Cần ép Flannel và Kubelet nhận diện số liệu từ card `enp0s8` (IP định nghĩa trong cấu hình là `192.168.56.x`).

**Bước 3.1. Ép Flannel CNI chạy trên cổng mạng `enp0s8` (Thực hiện trên máy Master):**
```bash
# Sửa thiết lập cấu hình chạy của kube-flannel 
kubectl -n kube-flannel patch daemonset kube-flannel-ds --type json -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--iface=enp0s8"}]'

# Xóa pod Flannel cũ đi để K8s tự động reset lại theo cấu hình mới 
kubectl delete pod -n kube-flannel -l app=flannel
```

**Bước 3.2. Ép thay đổi Node IP chuẩn cho Kubelet (Thực hiện trên Master và cả Worker):**

*Trên máy Master, thực thi lệnh:*
```bash
sudo sh -c 'echo "KUBELET_EXTRA_ARGS=--node-ip=192.168.56.10" > /etc/default/kubelet'
sudo systemctl daemon-reload && sudo systemctl restart kubelet
```

*Trên máy Worker (dùng terminal mới gõ `vagrant ssh worker`), thực thi lệnh:*
```bash
sudo sh -c 'echo "KUBELET_EXTRA_ARGS=--node-ip=192.168.56.11" > /etc/default/kubelet'
sudo systemctl daemon-reload && sudo systemctl restart kubelet
```

Sau khi sửa xong 2 lỗi thiết lập card mạng K8s trên, bạn xóa Metrics Server đi và cài lại (`kubectl delete -f ...` và `kubectl apply -f ...`) rồi đợi khoảng từ 1-2 phút là lệnh `kubectl top nodes` sẽ in ra thông tin CPU & RAM như kỳ vọng.
