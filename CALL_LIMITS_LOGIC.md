# Inka AI Assistant - Call Limits Logic

## 📋 Tổng quan
Logic tính toán giới hạn thời gian gọi đã được cập nhật để sử dụng giá trị cố định thay vì động từ token.

## ⚙️ Cấu hình mới (Database-Managed Limits)

### 🎯 Giới hạn được quản lý qua database:
1. **User Limit**: 5 phút/user/ngày (configurable)
2. **Total System Limit**: 180 phút/ngày (3 giờ) cho toàn hệ thống (configurable)
3. **Storage**: Lưu trong bảng `system_settings`
4. **Management**: API endpoints và Admin UI để thay đổi

### 🔄 Logic kiểm tra:
- **Kiểm tra Total limit TRƯỚC**: Nếu tổng thời gian gọi của tất cả user trong ngày đã đạt 180p
- **Kiểm tra User limit SAU**: Nếu user cụ thể đã gọi đủ 5p trong ngày
- **Cái nào đạt trước sẽ block user**

## 🏗️ Thay đổi Code

### Backend (`server/routes.ts`)
```javascript
// TRƯỚC (Dynamic from token):
const dailyTotalLimit = parseInt(userData.TOTAL_CALL_DURATION_PER_DAY || '60');
const dailyUserLimit = parseInt(userData.limit_call_duration_per_day || '5');

// SAU (Database-managed with fallback):
const dailyUserLimit = parseInt(await storage.getSetting('DAILY_USER_LIMIT_MINUTES') || '5');
const dailyTotalLimit = parseInt(await storage.getSetting('DAILY_TOTAL_LIMIT_MINUTES') || '180');
```

### API Endpoint Changes
```javascript
// TRƯỚC: Yêu cầu userData
app.post("/api/call/check-limits", async (req, res) => {
  const { userId, userData } = req.body;
  if (!userData) return res.status(400).json({ error: "userData is required" });

// SAU: Chỉ cần userId
app.post("/api/call/check-limits", async (req, res) => {
  const { userId } = req.body;
  // Không cần userData nữa
```

### Frontend (`client/src/components/VoiceAgent.tsx`)
```javascript
// TRƯỚC: Truyền userData
body: JSON.stringify({ 
  userId: userData.user_id.toString(),
  userData: userData
}),

// SAU: Chỉ truyền userId
body: JSON.stringify({ 
  userId: userData.user_id.toString()
}),
```

## 📊 Database Schema (Không thay đổi)

Vẫn sử dụng bảng `call_logs` để tracking:
```sql
- userId: ID của user
- durationSeconds: Thời lượng cuộc gọi (giây)
- date: Ngày gọi (YYYY-MM-DD)
- startTime, endTime: Thời gian bắt đầu/kết thúc
```

## 🔍 Flow Logic mới

### 1. User bấm "Start Call"
```
1. checkCallLimits() → POST /api/call/check-limits
2. Backend query database:
   - getTotalSecondsToday() → SUM(durationSeconds) WHERE date = today
   - getUserSecondsToday() → SUM(durationSeconds) WHERE userId = X AND date = today
3. So sánh:
   - totalSeconds >= (180 * 60) ? → "Hết giờ hệ thống"
   - userSeconds >= (5 * 60) ? → "Hết giờ cá nhân"
4. Nếu OK → Cho phép gọi
```

### 2. Trong cuộc gọi
```
- Start call log: POST /api/call/start
- Conversation với ElevenLabs
- End call log: POST /api/call/end (tính duration từ ElevenLabs)
```

### 3. Tính toán thời gian
```
- Dùng ElevenLabs timestamps để tính chính xác
- Lưu vào durationSeconds trong database
- Daily reset dựa trên date field
```

## 🚨 Error Messages

### Total Limit Exceeded (180p)
```json
{
  "error": "daily_total_limit_exceeded",
  "message": "Thời lượng gọi đã đủ trong ngày, mời bạn quay lại ngày hôm sau."
}
```

### User Limit Exceeded (5p)
```json
{
  "error": "daily_user_limit_exceeded", 
  "message": "Thời lượng gọi đã đủ trong ngày, mời bạn quay lại ngày hôm sau."
}
```

## ✅ Lợi ích của thay đổi

1. **Đơn giản hóa**: Không phụ thuộc vào external API
2. **Ổn định**: Không bị ảnh hưởng khi token API down
3. **Bảo mật**: Không thể modify limits từ frontend
4. **Performance**: Giảm API calls và dependency
5. **Kiểm soát tốt hơn**: Admin có control hoàn toàn
6. **Configurable**: Admin có thể thay đổi limits qua UI/API
7. **Persistent**: Limits được lưu vĩnh viễn trong database
8. **Audit Trail**: Track thời gian thay đổi settings

## 🎛️ Database Schema mới

### Table: `system_settings`
```sql
- id: Primary key
- key: Setting name (e.g., 'DAILY_USER_LIMIT_MINUTES')
- value: Setting value (e.g., '5')
- description: Human-readable description
- updatedAt: Last update timestamp
```

## 🔧 Admin Management APIs

### GET /api/admin/settings
Lấy tất cả settings

### POST /api/admin/settings
```json
{
  "key": "DAILY_USER_LIMIT_MINUTES",
  "value": "10",
  "description": "Daily call limit per user in minutes"
}
```

### GET /api/admin/settings/:key
Lấy setting theo key cụ thể

## 🔧 Monitoring

### Logs sẽ hiển thị:
```
Using fixed limits: User=5min, Total=180min
Call limits check for user 269:
- User seconds used today: 150/300 (2m 30s / 5m)
- Total seconds used today: 5400/10800 (90m 0s / 180m)
```

### Statistics API (`/api/usage-stats`):
- Vẫn hoạt động bình thường
- Hiển thị usage so với fixed limits
- Tracking per user và total system

## 📅 Reset Logic

- **Daily Reset**: Tự động reset mỗi ngày dựa trên date field
- **Cleanup**: Orphaned calls được cleanup mỗi 5 phút
- **Timezone**: Dựa trên server timezone (UTC)

---

**Kết luận**: Logic mới đơn giản, ổn định và dễ maintain hơn với fixed limits thay vì dynamic từ token.