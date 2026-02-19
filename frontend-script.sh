set -e
cd /home/ubuntu/storageApp-client
git pull
npm run test
npm run build
aws s3 cp ~/storageApp-client/dist s3://stoargeapp-client --recursive
aws cloudfront create-invalidation  --distribution-id E2CNKAHXYN3E9H   --paths "/*"
