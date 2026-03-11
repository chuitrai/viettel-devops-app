# Hướng dẫn chi tiết Giai đoạn 1 và Giai đoạn 2

Tài liệu này lưu trữ toàn bộ các thao tác, lệnh và lý thuyết cơ bản để thiết lập hạ tầng máy ảo (VM) bằng Vagrant và cài đặt cụm Kubernetes (K8s) bằng `kubeadm`.

---

## 🖥️ Phase 1: Khởi tạo Hạ tầng Ảo hóa (Virtual Machines)

Trong giai đoạn này, chúng ta sử dụng công cụ **Vagrant** cùng với **VirtualBox** để tự động hoá việc tạo ra 3 máy ảo (Master, Worker, HAProxy) với các thông số RAM, CPU và IP được định sẵn bằng Code (Infrastructure as Code).

### 1. Chuẩn bị thư mục và Khởi tạo File Vagrant
Trên máy tính Windows (Host), mở PowerShell hoặc Terminal và làm việc trong thư mục dự án `devops/vagrant`:

```bash
# Di chuyển vào thư mục dự án
cd C:\Users\ADMIN\Documents\pj\ViettelProject\devops\vagrant

# (Optional) Lệnh tạo file Vagrantfile ẩn danh ban đầu
vagrant init
```

### 2. Cấu hình & Chạy Máy Ảo
Mở file `Vagrantfile` và định nghĩa cấu hình máy bằng Ruby (Tham khảo code trong kho). Sau đó, thực thi lệnh thần thánh để đẻ ra 3 máy:

```bash
# Khởi tạo toàn bộ máy ảo (Vagrant sẽ tự tải Ubuntu Image và thi hành cấu hình)
vagrant up

# Kiểm tra trạng thái của các máy ảo (Phải hiện chữ "running")
vagrant status
```

### 3. Các lệnh điều khiển Máy Ảo (Tùy chọn)
Trong quá trình làm việc, Vagrant cung cấp các lệnh hữu ích để quản lý nguồn điện máy ảo mà không cần mở giao diện VirtualBox:

```bash
# Kết nối vào máy ảo (Master/Worker/HAProxy)
vagrant ssh master

# Tắt máy an toàn (Khuyên dùng khi nghỉ ngơi)
vagrant halt

# Tạm dừng máy nhanh - Ngủ đông (Có thể bị treo cần reload)
vagrant suspend
vagrant reload master

# Phá hủy hệ thống để làm lại từ đầu
vagrant destroy -f
```

---

## 👉 Phase 2: Cài đặt Kubernetes Cluster với kubeadm

Sau khi máy ảo hoạt động và thông IP với mạng Host-Only (192.168.56.x), chúng ta cần cài các phần mềm nền tảng của Kubernetes vào 2 máy `master` và `worker`. Việc này được tự động hóa bằng file bash script `install_k8s.sh` gắn trực tiếp vào `Vagrantfile` bằng tính năng Provision.

### 1. Kịch bản cài đặt thành phần (install_k8s.sh)
File này thực hiện các bước (được nạp tự động vào thư mục `/vagrant` trong VM):
*   Tắt tính năng Swap RAM.
*   Nạp các module kernel mạng: `overlay`, `br_netfilter`.
*   Bật cấu hình IP Forwarding (`net.ipv4.ip_forward = 1`).
*   Thêm kho phần mềm (Repositories) của Docker và K8s qua GPG Keys.
*   Cài đặt Container Runtime: `containerd.io`.
*   Cài đặt công cụ lõi K8s: `kubelet`, `kubeadm`, `kubectl` (Phiên bản v1.30).

**Nếu bạn muốn gọi lại thủ công file script này (khi bị lỗi), chạy trong VM:**
```bash
sudo bash /vagrant/install_k8s.sh
```

### 2. Khởi tạo Control Plane (Bộ Não)
**THỰC HIỆN TRÊN MÁY: K8s-MASTER**
Lệnh này ra lệnh cho máy Master sinh chứng chỉ, dựng CSDL (etcd) và lắng nghe Worker tại IP Tĩnh.

```bash
sudo kubeadm init \
  --apiserver-advertise-address=192.168.56.10 \
  --pod-network-cidr=10.244.0.0/16 \
  --node-name=master
```
*(Ghi chú: Lệnh này chạy xong sẽ in ra một đoạn mã `kubeadm join...` ở màn hình, cần phải bôi đen và COPY đoạn mã đó lại).*

### 3. Trao quyền thẻ từ cho người dùng
**THỰC HIỆN TRÊN MÁY: K8s-MASTER**
Copy file chứng chỉ gốc (`admin.conf`) vào thư mục User `vagrant` để dùng nhánh lệnh `kubectl` mà không bị K8s từ chối lệnh.

```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# Kiểm tra quyền:
kubectl get nodes
```

### 4. Rải thảm Mạng Lưới Nội Bộ (Pod Network - CNI)
**THỰC HIỆN TRÊN MÁY: K8s-MASTER**
Cài đặt Plugin Mạng Flannel để các Node và Container lồng nhau có đường đi chung. Phải làm bước này Node Master mới chuyển từ trạng thái `NotReady` sang `Ready`.

```bash
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
```

### 5. Kết nối Worker vào Cụm (Join Cluster)
**THỰC HIỆN TRÊN MÁY: K8s-WORKER**
SSH qua máy Worker, dán lệnh Join đã lưu ở bước trên kèm quyền Super User (sudo) để gia nhập đội quân.

```bash
# Ví dụ thay thế bằng Token thực tế
sudo kubeadm join 192.168.56.10:6443 --token abcdef.0123456789abcdef \
        --discovery-token-ca-cert-hash sha256:5ef... --node-name=worker
```

Cuối cùng, quay lại máy Master kiểm tra bằng `kubectl get nodes`, thấy cả hai đổi màu xanh "Ready" là Giai đoạn 2 thành công mỹ mãn.
