/**
 * Sends sample traffic to the demo Blog API so hits appear in the monitoring platform.
 *
 * Usage: npm run load-test
 */
const BASE_URL = process.env.BLOG_API_URL ?? "http://localhost:3002";

const paths = [
    "/api/posts",
    "/api/posts?tag=monitoring&limit=2",
    "/api/posts?author=Maya",
    "/api/posts/1/comments",
    "/api/posts/2/comments",
    "/api/posts/3/comments",
    "/api/posts/99/comments",
    "/health",
];


/**
 * Sleeps for the given number of milliseconds.
 */
async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}


/**
 * Hits the given path.
 */
async function hit(path: string): Promise<void> {
    const url = `${BASE_URL}${path}`;
    const started = Date.now();
    const res = await fetch(url);
    const elapsed = Date.now() - started;
    console.log(`${res.status} ${path} (${elapsed}ms)`);
}


async function main(): Promise<void> {
    console.log(`Load test target: ${BASE_URL}\n`);

    for (let round = 0; round < 3; round++) {
        console.log(`--- Round ${round + 1} ---`);
        
        for (const path of paths) {
            try { await hit(path); } 
            catch (error) { 
                console.error(`Failed ${path}:`, error); 
            }
            
            await sleep(150);
        }
        await sleep(500);
    }

    console.log("\nDone. Check monitoring analytics for serviceName=blog-api.");
}

void main();
