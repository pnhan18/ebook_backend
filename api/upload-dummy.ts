import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
    endpoint: process.env.R2_ENDPOINT,
    region: 'auto',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

async function uploadDummyContent() {
    const key = 'books/28/chapters/chuong-70.html';
    const content = `
    <html>
        <body>
            <p>Đây là nội dung thử nghiệm cho tính năng Audio Streaming.</p>
            <p>Chúng tôi đang sử dụng Azure Text to Speech để đọc nội dung này trực tiếp.</p>
            <p>Nếu bạn nghe thấy giọng đọc này, nghĩa là tính năng streaming đã hoạt động thành công.</p>
            <p>Chúc bạn một ngày tốt lành!</p>
        </body>
    </html>
    `;

    console.log(`Uploading dummy content to: ${key}`);

    try {
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: content,
            ContentType: 'text/html',
        });

        await s3Client.send(command);
        console.log('✅ Upload success!');
    } catch (error) {
        console.error('❌ Upload failed:', error);
    }
}

uploadDummyContent();
