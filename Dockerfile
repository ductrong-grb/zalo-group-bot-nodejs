# Sử dụng image Node.js LTS Alpine nhẹ
FROM node:lts-alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Sao chép file package.json và cài đặt dependencies
COPY package.json ./
RUN npm install

# Sao chép toàn bộ mã nguồn
COPY . .

# Expose cổng 7860 (yêu cầu của Hugging Face Spaces)
EXPOSE 7860

# Lệnh khởi động bot
CMD ["node", "index.js"]