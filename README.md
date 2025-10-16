# Azure Communication Service Demo - Video Calling App

Ứng dụng call họp sử dụng Azure Communication Service với Angular frontend và Node.js backend.

## Tính năng

- ✅ Tạo phòng họp và tham gia phòng
- ✅ Control device camera/microphone
- ✅ Phòng chờ với phân quyền chủ phòng
- ✅ Chủ phòng phải phê duyệt người tham dự
- ✅ UI đơn giản, dễ sử dụng
- ✅ Hỗ trợ nhiều người tham dự

## Công nghệ sử dụng

### Backend
- Node.js
- Express.js
- Azure Communication Service SDK
- CORS

### Frontend
- Angular 19.2.5
- Tailwind CSS
- Azure Communication Service JS SDK
- TypeScript

## Cài đặt

### 1. Cài đặt Azure Communication Service

1. Tạo Azure Communication Service resource trong Azure Portal
2. Lấy Connection String từ resource
3. Copy file `server/env.example` thành `server/.env` và điền connection string

### 2. Cài đặt dependencies

```bash
# Cài đặt tất cả dependencies
npm run install-all

# Hoặc cài đặt từng phần
npm install
cd server && npm install
cd ../client && npm install
```

### 3. Chạy ứng dụng

```bash
# Chạy cả frontend và backend
npm run dev

# Hoặc chạy riêng lẻ
npm run server  # Backend trên port 3000
npm run client  # Frontend trên port 4200
```

## Sử dụng

1. Truy cập `http://localhost:4200`
2. **Tạo phòng họp:**
   - Nhập tên của bạn
   - Click "Tạo phòng"
   - Chia sẻ Room ID cho người khác

3. **Tham gia phòng họp:**
   - Nhập Room ID và tên của bạn
   - Click "Tham gia phòng"
   - Chờ chủ phòng phê duyệt (nếu không phải chủ phòng)

4. **Trong phòng họp:**
   - Sử dụng các nút điều khiển để bật/tắt mic và camera
   - Chủ phòng có thể phê duyệt người tham dự từ phòng chờ
   - Chủ phòng có thể kết thúc phòng họp

## Cấu trúc dự án

```
acs-demo/
├── server/                 # Node.js backend
│   ├── index.js           # Main server file
│   ├── package.json       # Backend dependencies
│   └── env.example        # Environment variables template
├── client/                # Angular frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── home/      # Trang chủ
│   │   │   │   └── room/      # Phòng họp
│   │   │   ├── services/
│   │   │   │   ├── api.service.ts           # API calls
│   │   │   │   └── communication.service.ts # Azure Communication Service
│   │   │   ├── app.component.ts
│   │   │   └── app.routes.ts
│   │   ├── styles.scss    # Tailwind CSS
│   │   └── main.ts
│   ├── angular.json
│   ├── tailwind.config.js
│   └── package.json
├── package.json           # Root package.json
└── README.md
```

## API Endpoints

### Backend API

- `POST /api/rooms` - Tạo phòng họp
- `POST /api/rooms/:roomId/join` - Tham gia phòng họp
- `GET /api/rooms/:roomId` - Lấy thông tin phòng
- `POST /api/rooms/:roomId/approve/:userId` - Phê duyệt người dùng
- `GET /api/rooms/:roomId/waiting` - Lấy danh sách chờ
- `POST /api/rooms/:roomId/end` - Kết thúc phòng
- `POST /api/rooms/:roomId/leave/:userId` - Rời phòng

## Lưu ý

- Đây là ứng dụng demo, không phù hợp cho production
- Cần có Azure Communication Service resource để chạy
- Cần camera và microphone để test đầy đủ tính năng
- UI được thiết kế đơn giản để phát triển nhanh

## Troubleshooting

1. **Lỗi "AZURE_COMMUNICATION_CONNECTION_STRING is not set"**
   - Kiểm tra file `.env` trong thư mục `server/`
   - Đảm bảo connection string đúng

2. **Không thể truy cập camera/microphone**
   - Kiểm tra quyền truy cập camera/microphone của trình duyệt
   - Đảm bảo có thiết bị camera/microphone

3. **Lỗi CORS**
   - Đảm bảo backend đang chạy trên port 3000
   - Kiểm tra cấu hình CORS trong server

## Phát triển thêm

- Thêm tính năng chat trong phòng họp
- Thêm tính năng chia sẻ màn hình
- Cải thiện UI/UX
- Thêm authentication thực tế
- Thêm database để lưu trữ phòng họp
