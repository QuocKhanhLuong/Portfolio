# Đồng bộ nhật ký R&D từ GitHub sang Airtable

Bộ đồng bộ trung tâm nằm trong thư mục `rnd-control` của `QuocKhanhLuong/Portfolio`, phục vụ base `Alvin R&D OS`. Đây không phải một repository `rnd-control` riêng.

## Phạm vi thực sự

- Đọc commit trên **nhánh mặc định** của các repository trong `projects.json`.
- Nhóm theo repository/ngày ở múi giờ `Asia/Bangkok`, tạo hoặc bổ sung một nhật ký có khóa cố định. Chạy lại cùng dữ liệu không tạo thêm bản ghi.
- Dùng ID bảng, cột và dự án thay cho tên hiển thị; đổi tên sang tiếng Việt không làm hỏng ánh xạ.
- Giữ đầy đủ SHA và dữ liệu sự kiện đã nhập trong `Dữ liệu Git gốc`; bản tóm tắt tự động là thống kê tiếng Việt, tiêu đề commit nguyên văn được giữ trong bằng chứng gốc.
- Không coi commit có chữ `test` là kiểm thử đã đạt; không suy ra đã triển khai thành công, cải thiện mô hình hoặc hoàn tất dự án.
- Không sửa trạng thái, phần trăm tiến độ, trọng tâm, quyết định, hành động tiếp theo hoặc hạn chót của dự án. Các cập nhật có diễn giải vẫn cần người dùng/trợ lý xác nhận theo bằng chứng.
- Không đọc cuộc trò chuyện ChatGPT. Chưa thu thập PR, issue, release hoặc kết quả CI riêng; merge commit xuất hiện trong lịch sử nhánh mặc định vẫn được đọc như commit.

## Lịch và điều kiện chạy

Workflow `.github/workflows/rnd-airtable-sync.yml` khai báo lịch **00:15 hằng ngày UTC+7**, tương ứng cron UTC `15 17 * * *`. Ngoài ra có `workflow_dispatch` để chạy thủ công và kiểm tra khi sửa chính mã/cấu hình đồng bộ trên `main`.

**Có cron không đồng nghĩa đã đồng bộ thành công.** Cần một lần chạy thực tế với thông tin xác thực hợp lệ. Kiểm tra kết quả tại Actions → R&D Airtable Sync → phần Summary của lần chạy. GitHub có thể chạy lịch trễ khi tải cao.

Cửa sổ mặc định 36 giờ; khi bỏ lỡ lịch, chương trình mở rộng từ lần đồng bộ thành công trước đó. Ngày hoạt động lấy theo commit; thời điểm kiểm tra lấy theo lần chạy thực tế. Không có commit mới thì không tạo nhật ký tiến độ giả.

## Thông tin xác thực

Tại repository `QuocKhanhLuong/Portfolio` → Settings → Secrets and variables → Actions:

- `AIRTABLE_TOKEN`: Airtable Personal Access Token với `data.records:read`, `data.records:write`, chỉ cấp cho base `app9IpgoLjTQYwsW4`. Mã không cần quyền sửa cấu trúc bảng.
- `GH_SYNC_TOKEN`: chỉ cần khi repository theo dõi không đọc được bằng `GITHUB_TOKEN` của workflow, chẳng hạn repository riêng tư ở nơi khác. Token cần được cấp quyền đọc đúng repository; không dùng token không được phép truy cập.

Không đưa token vào mã nguồn, nhật ký, issue hay nội dung chat. Mã lấy token từ biến môi trường. Thiếu `AIRTABLE_TOKEN` sẽ báo lỗi rõ và kết thúc khác 0, không báo đồng bộ thành công.

## Lỗi và phục hồi

Một repository lỗi sẽ được ghi vào báo cáo; các repository còn lại vẫn tiếp tục. Toàn bộ lần chạy trả mã 2 khi có bất kỳ lỗi nào. Mốc đồng bộ của repository lỗi không được đẩy lên, để lần sau có thể kiểm tra lại.

P-112 được giữ trong cấu hình. Các lần kiểm tra qua kết nối trước đó trả HTTP 404 cho `AI20K-Build-Phase-Cohort-3/P-112`; chưa phân biệt được không có quyền với repository không tồn tại/đã chuyển. Cần xác minh địa chỉ và quyền đọc, không tự coi đây là dự án không còn hoạt động.

HTTP 429/lỗi mạng/lỗi máy chủ chỉ được thử lại số lần giới hạn. Lịch sử vượt 5.000 commit trong một cửa sổ, dữ liệu gốc hỏng, khóa trùng hoặc nhật ký quá dài đều báo lỗi thay vì cắt mất bằng chứng. Nhật ký có `curated: true` giữ phần diễn giải do người/trợ lý biên tập.

## Kiểm thử

Yêu cầu Python 3.10 trở lên, không cần cài gói bổ sung:

```sh
python3 -m py_compile rnd-control/sync_airtable.py
python3 -m unittest discover -s rnd-control/tests -v
```

Bộ hiện tại có 20 kiểm thử đơn vị với mạng giả lập: ID ổn định, nhiều commit trong một ngày, thêm commit muộn, ngày UTC+7, chống trùng, giữ ghi chú, phân trang, giới hạn thử lại, lỗi một phần và thiếu token. Đây **không phải** bằng chứng xác thực đầu-cuối tới Airtable.

## Kiểm tra thủ công và nhập lịch sử

Sau khi đã cấp token bằng môi trường an toàn:

```sh
# Đọc và lập kế hoạch nhưng không ghi
LOOKBACK_HOURS=36 python3 rnd-control/sync_airtable.py --dry-run

# Nhập lịch sử 30 ngày; kiểm tra bản dry-run trước
LOOKBACK_HOURS=720 python3 rnd-control/sync_airtable.py --dry-run
LOOKBACK_HOURS=720 python3 rnd-control/sync_airtable.py
```

Nhật ký lịch sử biên tập trước đây chỉ lưu các mốc chọn lọc, không chứng minh đã nhập toàn bộ Git history. Chống trùng với bản cũ chỉ dựa trên SHA/liên kết đã được lưu; commit chưa được lưu bằng mã cụ thể có thể tạo nhật ký bổ sung. Không tự xóa các nhật ký cũ.

## Tệp chính

`projects.json`: repository → ID dự án Airtable. `sync_airtable.py`: đọc, nhóm, upsert và báo lỗi. `tests/test_sync.py`: kiểm thử không gọi mạng. Workflow: kiểm thử trước, sau đó mới đồng bộ với secrets; kết quả được ghi vào `GITHUB_STEP_SUMMARY`.
