const fs = require('fs');
const http = require('http');
const path = require('path');

// Cấu hình
const API_URL = 'http://localhost:3000/audio/chapter/2155'; // ID chapter đã có dummy content
const OUTPUT_FILE = 'test_output.mp3';
const AUTH_TOKEN = '';

async function testAudioStream() {
    console.log(`Testing audio stream from: ${API_URL}`);
    const startTime = Date.now();

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                ...(AUTH_TOKEN && { 'Authorization': `Bearer ${AUTH_TOKEN}` }),
            },
        });

        const ttfb = Date.now() - startTime;
        console.log(`⏱️ Time to First Byte (TTFB): ${ttfb}ms`);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        console.log(`Content-Type: ${contentType}`);

        if (contentType.includes('application/json')) {
            const data = await response.json();
            console.log('Received JSON response (Cached Audio):');
            console.log(JSON.stringify(data, null, 2));
        } else if (contentType.includes('audio/')) {
            console.log('Received Audio Stream. Saving to file...');

            const fileStream = fs.createWriteStream(OUTPUT_FILE);
            const reader = response.body.getReader();
            let totalBytes = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                fileStream.write(Buffer.from(value));
                totalBytes += value.length;
                process.stdout.write(`\rDownloaded: ${(totalBytes / 1024).toFixed(2)} KB`);
            }

            fileStream.end();
            const totalTime = Date.now() - startTime;
            console.log(`\n\n✅ Success! Audio saved to: ${path.resolve(OUTPUT_FILE)}`);
            console.log(`⏱️ Total Time: ${totalTime}ms`);
            console.log(`📊 Average Speed: ${(totalBytes / 1024 / (totalTime / 1000)).toFixed(2)} KB/s`);
        } else {
            console.log('Unknown content type:', contentType);
            const text = await response.text();
            console.log('Body:', text);
        }

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
    }
}

testAudioStream();
