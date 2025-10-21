// import { createClient } from "redis";

// const redisClient = createClient();

// redisClient.on("error", (err) => {
//   console.log("Redis Client Error", err);
//   process.exit(1);
// });

// await redisClient.connect();

// export default redisClient;


import { createClient } from 'redis';

const client = createClient({
    username: 'default',
    password: 'hFin9oCBWtC4bBtBtBfYymVSjNVMuzrJ',
    socket: {
        host: 'redis-19532.crce206.ap-south-1-1.ec2.redns.redis-cloud.com',
        port: 19532
    }
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

await client.set('foo', 'bar');
const result = await client.get('foo');
console.log(result)  // >>> bar



client.on('error', err => console.log('Redis Client Error', err));

// await client.connect();
export default client;




