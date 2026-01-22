import { PrismaClient } from '@prisma/client';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Cấu hình S3 từ .env (bạn cần đảm bảo .env đã load hoặc điền trực tiếp để test)
// Lưu ý: Script này cần chạy với dotenv để load biến môi trường
const s3Client = new S3Client({
    endpoint: process.env.R2_ENDPOINT,
    region: 'auto',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

async function debugChapter(chapterId: number) {
    console.log(`Checking chapter ${chapterId}...`);

    const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
    });

    if (!chapter) {
        console.error('❌ Chapter not found in DB');
        return;
    }

    console.log('✅ Chapter found:', {
        id: chapter.id,
        title: chapter.title,
        contentKey: chapter.contentKey,
    });

    if (!chapter.contentKey) {
        console.error('❌ contentKey is NULL');
        return;
    }

    console.log(`Attempting to download from S3: ${chapter.contentKey}`);
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: chapter.contentKey,
        });
        const response = await s3Client.send(command);
        console.log('✅ Download success! Content Type:', response.ContentType);
    } catch (error) {
        console.error('❌ Download failed:', error.message);
        if (error.Code) console.error('Error Code:', error.Code);
    }
}

// Chạy debug cho chapter 2155
debugChapter(2155)
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
