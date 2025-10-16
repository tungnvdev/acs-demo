- Ứng dụng call họp sử dụng Azure Communicate Service
- Sử dụng JS SDK sau :
    "@azure/communication-calling": "^1.38.1",
    "@azure/communication-calling-effects": "^1.1.4",
    "@azure/communication-common": "^2.4.0",
    "@azure/communication-identity": "^1.3.1",
- Backend : NodeJS
- Frontend: Angular version 19.2.5 + Tailwind css
- Chức năng:
  + Tạo room, join room, control device camera/mic, leave room, end room
  + Có prepare device trước khi join room.
  + call họp nhiều người phân quyền rõ ràng
  + người tham dự phải  được chủ phòng đồng ý mới được join(phòng chờ)
- Vì là source demo thôi nên cần phải phát triển tốc dộ nên không yêu cầu UI phức tạp càng đơn giản càng tối
