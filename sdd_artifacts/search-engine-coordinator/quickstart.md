# Quickstart: SearchEngine Coordinator

## Prerequisites
- Đã cài đặt các dependencies thông qua `npm install`
- Ứng dụng Backend NestJS có thể chạy được (`npm start`)

## Setup
Không yêu cầu setup đặc biệt nào khác. `SearchEngine` hoạt động thuần túy trong Memory (không phụ thuộc Database hay Service ngoài).

## Validation Scenarios

### Scenario 1: Lấy Candidate ngẫu nhiên (RANDOM)
1. Trong một file Test (hoặc tạm thời gắn vào một endpoint), inject `SearchEngine`.
2. Gọi `const strategies = searchEngine.generateCandidates(5, 'RANDOM');`
3. ✅ Expected: Trả về một mảng gồm đúng 5 đối tượng `IStrategy`.

### Scenario 2: Lấy Candidate theo Domain (DOMAIN_GUIDED)
1. Gọi `const strategies = searchEngine.generateCandidates(3, 'DOMAIN_GUIDED');`
2. ✅ Expected: Trả về một mảng gồm 3 đối tượng `IStrategy` (thường là `CompositeStrategy` đã được bọc các thuật toán con đa dạng).

### Scenario 3: Gọi loại Generator không tồn tại
1. Gọi `searchEngine.generateCandidates(1, 'GENETIC' as any);`
2. ✅ Expected: `Error` được throw ra với message báo loại generator không được hỗ trợ.
