# 📘 Group API — Hướng dẫn vận hành

Tài liệu này giải thích cách hoạt động của **Group API** trong mobile app, bao gồm luồng dữ liệu từ Frontend → Backend.

---

## 1. Kiến trúc tổng quan

```
┌──────────────────┐     HTTP/REST      ┌──────────────────┐
│   Mobile App     │ ──────────────────► │   NestJS BE      │
│   (React Native) │   Bearer Token     │   /api/groups/*  │
│                  │ ◄────── JSON ────── │   + Prisma ORM   │
└──────────────────┘                    └──────────────────┘
```

**Luồng hoạt động:**

1. User đăng nhập → nhận `access_token` (JWT)
2. Token được lưu vào `AsyncStorage` và tự động gắn vào mỗi request qua `axiosConfig.ts`
3. Mọi endpoint `/api/groups/*` đều yêu cầu token hợp lệ

---

## 2. Cấu trúc code trong Mobile

| File                                 | Vai trò                                              |
| ------------------------------------ | ---------------------------------------------------- |
| `api/endpoint.ts`                    | Định nghĩa tất cả URL endpoint                       |
| `types/group.ts`                     | TypeScript interfaces (Group, GroupMember, payloads) |
| `services/groupService.ts`           | Gọi API, return typed data                           |
| `screens/main/GroupsScreen.tsx`      | Danh sách nhóm (GET list)                            |
| `screens/main/GroupDetailScreen.tsx` | Chi tiết nhóm + thành viên                           |
| `screens/main/CreateGroupScreen.tsx` | Tạo/Sửa nhóm                                         |
| `screens/main/AddMemberScreen.tsx`   | Thêm thành viên                                      |

---

## 3. Các Endpoint và cách sử dụng

### 3.1 Danh sách nhóm

```
GET /api/groups?page=1&limit=20&search=Alpha
```

- **Ai gọi:** `GroupsScreen` khi mở tab Groups hoặc pull-to-refresh
- **Logic BE:** Student/Group Leader chỉ thấy nhóm mình thuộc. Lecturer/Admin thấy tất cả
- **Response:** `{ data: Group[], meta: { total, page, limit, total_pages } }`
- **Code MO:** `groupService.getGroups(params)`

### 3.2 Chi tiết nhóm

```
GET /api/groups/:id
```

- **Ai gọi:** `GroupDetailScreen` khi user tap vào 1 card
- **Response:** `GroupDetail` = thông tin nhóm + danh sách members
- **Code MO:** `groupService.getGroupById(id)`

### 3.3 Tạo nhóm mới

```
POST /api/groups
Body: { name: "Team Alpha", project_name?: "...", description?: "...", semester?: "...", github_repo_url?: "...", jira_project_key?: "..." }
```

- **Ai gọi:** `CreateGroupScreen` khi user bấm submit
- **Logic BE:** Tự động thêm người tạo làm **LEADER**
- **Bắt buộc:** chỉ `name`
- **Code MO:** `groupService.createGroup(payload)`

### 3.4 Cập nhật nhóm

```
PATCH /api/groups/:id
Body: { name?: "...", project_name?: "...", status?: "ACTIVE" | "ARCHIVED" | "COMPLETED", ... }
```

- **Ai được phép:** Leader của nhóm hoặc Admin
- **Ai gọi:** `CreateGroupScreen` trong "Edit mode" (phát hiện qua `route.params.groupId`)
- **Code MO:** `groupService.updateGroup(id, payload)`

### 3.5 Xóa nhóm

```
DELETE /api/groups/:id
```

- **Ai được phép:** Chỉ Admin
- **Ai gọi:** `GroupDetailScreen` → nút "Delete Group"
- **Code MO:** `groupService.deleteGroup(id)`

---

## 4. Quản lý thành viên

### 4.1 Thêm thành viên

```
POST /api/groups/:id/members
Body: { user_id: "uuid-string", role_in_group?: "MEMBER" | "LEADER" | "MENTOR" }
```

- **Ai được phép:** Leader hoặc Admin
- **Logic:** Nếu user đã từng rời nhóm (soft-delete), sẽ được thêm lại
- **Code MO:** `groupService.addMember(groupId, payload)`

### 4.2 Đổi vai trò thành viên

```
PATCH /api/groups/:id/members/:userId
Body: { role_in_group: "LEADER" }
```

- **Ai được phép:** Leader hoặc Admin
- **Code MO:** `groupService.updateMemberRole(groupId, userId, role)`

### 4.3 Xóa thành viên

```
DELETE /api/groups/:id/members/:userId
```

- **Ai được phép:** Leader hoặc Admin
- **Logic:** Không cho xóa leader cuối cùng. Phải set leader khác trước
- **Code MO:** `groupService.removeMember(groupId, userId)`

### 4.4 Rời nhóm (tự nguyện)

```
DELETE /api/groups/:id/members/me
```

- **Ai gọi:** Bất kỳ thành viên nào (không phải leader cuối cùng)
- **Code MO:** `groupService.leaveGroup(groupId)`

---

## 5. Vai trò (Roles)

| Role     | Quyền                                      |
| -------- | ------------------------------------------ |
| `LEADER` | Tạo/sửa nhóm, thêm/xóa/đổi role thành viên |
| `MENTOR` | Chỉ xem (giảng viên hướng dẫn)             |
| `MEMBER` | Chỉ xem, có thể rời nhóm                   |

---

## 6. Xử lý lỗi

Tất cả lỗi từ BE trả về format:

```json
{ "message": "User is already a member of this group", "statusCode": 400 }
```

Mobile bắt lỗi qua `error.response?.data?.message` và hiện toast notification.

---

## 7. Luồng khi user sử dụng

```
GroupsScreen ──tap card──► GroupDetailScreen ──edit──► CreateGroupScreen (edit mode)
     │                          │
     │                          ├── add member ──► AddMemberScreen
     │                          ├── change role ──► Alert dialog
     │                          ├── remove member ──► Alert confirm
     │                          └── leave/delete ──► Alert confirm → goBack()
     │
     └── "+" button ──► CreateGroupScreen (create mode)
```
