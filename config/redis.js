
import { createClient } from 'redis';

const client = createClient({
    username: 'default',
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: 'redis-19532.crce206.ap-south-1-1.ec2.redns.redis-cloud.com',
        port: 19532
    }
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();
console.log("redis connected")  // >>> bar



client.on('error', err => console.log('Redis Client Error', err));

// await client.connect();
export default client;




