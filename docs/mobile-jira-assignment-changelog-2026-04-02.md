# Changelog Mobile - Luong Task/Jira/Evaluation

Ngay cap nhat: 2026-04-02  
Pham vi: mo-repo (React Native)

## 1) Tong quan van de trong buoi lam viec

Trong qua trinh test, team gap cac van de chinh:
- User khong nam trong team Jira project van co the claim task trong app.
- Co truong hop task tren app da doi trang thai, nhung Jira issue van TO DO va unassigned.
- Loi tao task (dac biet case assign khong hop le) hien toast ben ngoai, kho debug khi dang mo modal New Task.
- Role UI chua dung theo nghiep vu (member khong thay nut Evaluation; overdues tren Dashboard bi tinh nham la My Tasks).

Muc tieu la lam ro mobile da thay doi gi, va nhung phan can BE enforce de dong bo hanh vi.

## 2) Cac thay doi da lam tren Mobile

### 2.1 Chuyen check Jira tu project access sang assignable

- Da bo sung endpoint path cho assignable check.
- Da bo sung service goi API check assignable cho current user.
- Trong GroupDetail, thay check access cu bang check assignable khi thao tac task cua member.

Tac dong UX:
- Neu khong assignable: chan thao tac va hien canh bao.
- Neu check dang pending: chan tam thoi, hien thong bao cho nguoi dung thu lai sau.

### 2.2 Chan action claim/done theo ket qua check Jira

Trong GroupDetail:
- Action Claim task va Mark Done cua member deu check trang thai Jira truoc khi goi API.
- Neu fail check thi khong cho di tiep.

### 2.3 Hien loi trong chinh modal New Task (thay vi toast ngoai man hinh)

- Da them state loi local cho form task.
- Khi tao/sua task fail, loi hien inline trong modal New Task (khung loi mau do).
- Da clear loi khi dong modal/mo modal moi.

Ket qua: de debug hon cho case "assign user khong hop le tren Jira".

### 2.4 Dieu chinh UI task cho member

- Member co the thay nut thao tac cho luong nghiep vu:
  - Claim task khi task dang unassigned.
  - Mark Done khi task dang assign cho chinh member do.
- Da bo sung fallback matching theo assignee_name trong thoi diem BE chua tra/on dinh assignee_id.

### 2.5 Evaluation UI theo role

- Member/mentor co the xem evaluation.
- Chi leader moi thay nut edit/delete.

### 2.6 Nut Evaluation tren GroupDetail

- Truoc day chi leader thay nut.
- Da doi de member/mentor cung thay nut vao man Evaluation (read-only), label phu hop role.

### 2.7 Sua Dashboard My Tasks

- Da doi filter My Tasks theo assignee_id (khong dung so sanh ten string nua) de tranh hien task cua nguoi khac vao muc cua minh.

### 2.8 Cai thien check va canh bao Jira membership trong GroupDetail

- Da them flow check Jira access/assignable khi vao GroupDetail.
- Da them popup canh bao neu user chua du dieu kien Jira cho task actions.

## 3) Cac van de da phat hien can BE xu ly/chot logic

### 3.1 Project Open access gay duong check sai ky vong

Neu Jira project dang Open, check access co the true cho nhieu user, nhung nghiep vu can stricter (phai assignable hoac explicit member).

Huong can BE chot:
- Neu rule la "co trong team Jira project" thi can check theo tieu chi do o BE.
- Khong chi dua vao project view access.

### 3.2 Dong bo trang thai Jira issue khi assign/transition fail tung buoc

Can BE dam bao sync task theo tung step doc lap:
- Tao issue xong phai luu link ngay.
- Assign fail khong duoc lam mat link issue.
- Transition fail can log ro rang, khong nuot loi mo ho.

### 3.3 Case member leave group roi join lai

Da co bug duplicate membership (composite key) trong flow rejoin. Can BE dam bao re-activate membership cu thay vi tao record moi.

### 3.4 Khi member join group co Jira project

Nhu cau nghiep vu: co canh bao ro rang de member biet phai duoc add vao Jira project boi leader.

De xuat handoff:
- Tra them thong tin note/invite trong response join/add member neu group co jira_project_key.
- Mobile hien banner/alert mot lan de huong dan user.

## 4) Ket qua verify da chay

Da chay check tren mobile:
- npm run typecheck: pass
- npm run lint: pass (sau khi don warning/style)

Ghi chu:
- Co nhieu van de la policy va data-sync phai enforce o BE, mobile chi co the chan UX o client.

## 5) De nghi BE team chot de fix 1 lan

1. Xac nhan dứt khoat rule Jira membership (access vs assignable vs explicit project member).  
2. Enforce rule o BE cho claim task va update status task trong Jira-linked group.  
3. Tra message loi ro rang, on dinh de mobile hien trong New Task modal.  
4. Dam bao sync issue theo step an toan (create/link, assign, transition) va log du de trace.  
5. Co co che thong bao/member onboarding khi vua join group co Jira project.

## 6) Tom tat ngan de gui nhanh

- Mobile da doi check sang assignable flow, da chan action claim/done theo check, da dua loi tao task vao trong New Task modal.  
- Mobile da sua role UI cho Evaluation va My Tasks filter.  
- Nhung van de con lai lien quan policy Jira membership va sync guarantee can BE chot/enforce de dung hanh vi 100%.
