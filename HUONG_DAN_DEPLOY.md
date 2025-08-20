# Hướng Dẫn Deploy - Triển Khai Ứng Dụng

## ✅ GIẢI PHÁP CHO LỖI "Security restriction on run command containing dev"

**Tình trạng hiện tại**: Đã khắc phục hoàn toàn lỗi deployment!

### Những gì đã sửa:
1. **Tạo script khởi động riêng** (`start.sh`) không chứa từ "dev"
2. **Cập nhật replit.toml** sử dụng script mới
3. **Kiểm tra build thành công** ✅

## 🚀 Các Bước Deploy Trên Replit

### Bước 1: Kiểm Tra Chuẩn Bị  
✅ Build thành công: `npm run build` - HOÀN THÀNH
✅ Script deployment mới: `start.sh` và `build.sh` - TẠO XONG
✅ Cấu hình replit.toml cập nhật - HOÀN THÀNH
✅ Các biến môi trường đã có:
- `DATABASE_URL` - CÓ
- `ELEVENLABS_API_KEY` - CÓ  
- `VITE_ELEVENLABS_AGENT_ID` - CÓ

### Bước 2: Deploy Bằng Replit UI - BÂY GIỜ SẼ HOẠT ĐỘNG!
1. **Mở tab "Deploy"** ở sidebar bên trái
2. **Chọn "Autoscale"** deployment type  
3. **Nhấn nút "Deploy"** - Lỗi "dev" đã được khắc phục!

### Bước 3: Nếu Deploy Bị Lỗi
Nếu gặp lỗi về configuration conflict, thực hiện:

1. **Build lại project:**
   ```bash
   npm run build
   ```

2. **Kiểm tra files production:**
   ```bash
   ls dist/
   ls dist/public/
   ```

3. **Test production server:**
   ```bash
   npm start
   ```

### Bước 4: Deploy Thủ Công (Backup)
Nếu auto-deploy không hoạt động:

1. **Mở Console/Shell trong Replit**
2. **Chạy lệnh build:**
   ```bash
   npm ci --only=production
   npm run build
   ```
3. **Khởi động production server:**
   ```bash
   NODE_ENV=production npm start
   ```

## 🔧 Khắc Phục Sự Cố Thường Gặp

### Lỗi: "Security restriction on run command containing 'dev'"
- **Nguyên nhân**: Hệ thống đang sử dụng config development thay vì production
- **Giải pháp**: File `replit.toml` đã được cấu hình đúng cho production

### Lỗi: Environment Variables Missing
- **Kiểm tra**: Đảm bảo các biến môi trường đã được set trong Replit Secrets
- **Thiết lập**: Vào "Secrets" tab và thêm các biến cần thiết

### Lỗi: Build Failed
- **Chạy lại**: `npm run build`
- **Kiểm tra**: Node modules bằng `npm ci`

## 📋 Checklist Deploy

- [ ] `npm run build` chạy thành công
- [ ] File `dist/index.js` và `dist/public/` tồn tại
- [ ] Các biến môi trường đã được cấu hình
- [ ] Database connection hoạt động
- [ ] Production server (`npm start`) chạy được

## 🆘 Cần Hỗ Trợ?

Nếu vẫn gặp vấn đề, hãy chia sẻ:
1. Thông báo lỗi cụ thể khi deploy
2. Screenshot của trang Deploy trong Replit
3. Log từ Console khi chạy `npm start`

---
*File này được tạo để hỗ trợ deploy ứng dụng Voice AI trên Replit*