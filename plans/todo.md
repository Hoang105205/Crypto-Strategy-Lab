1. Register/Login Database -> Mỗi user cần đăng nhập -> có leader board riêng (hiện strategy do người đó tự đăng ký + loop strategy của system tìm ra)

2. Hiển thị biểu đồ real-time
    2.1 Load lịch sử nến (~1000 cây nến tương ứng cho từng khung thời gian 1m, 5m...) -> đã done
    2.2 Hiển thị cây nến hiện tại Realtime
        Nếu cây nến hiện tại trùng với cây nến cuối cùng
        Nếu cây nến hiện tại là cây nến mới hoàn toàn
    Question: Làm sao có thể hỗ trợ 3000 (!?) người
        1000 người truy cập vào trang này, 1 người sử dụng 4 khung thời gian khác nhau = 4000 connection

3. Strategy kết hợp
    Thủ công: kết hợp các strategy đơn -> đã done
    Tự động: Loop Discovery- tự động kết hợp các strategy để tìm biến thể tốt nhất và hiển thị lên leaderboard (Xong 1 phần, chưa làm theo user)

4. Output: Bảng kết quả (Trang Strategy)
    Pair/Coin
    Thời gian vào lệnh
    Hướng: LONG/SHORT
    Khối lượng: USD
    Giá vào lệnh
    Stoploss
    TakeProfit
    Giá kết thúc
    Transaction Cost (Phí)
    Slipage/Spread (giả lập 5bps)
    Profit

5. Thống kê: (Trang chủ)
    Winrate: 40% wins: 40 lessess: 60
    Total Profit: 50$
    Max Drawn Down: 70%
-> Visualize trên biểu đồ

6. Crawler tin tức và hiển thị (Lưu ý về vấn đề extract data từ tag html, dùng LLM hiểu tag và lưu vào db để tái sử dụng lần sau) -> đã done
Sử dụng mô hình máy học (LLM) để phân tích thông tin thị trường -> đã done

Note:
- Leaderboard là riêng cho mỗi user
- Worker phải chạy loop 24/24. Có button để bật/tắt chế độ (theo góc nhìn của user)