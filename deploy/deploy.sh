#!/bin/bash

# run this from the deploy folder

SG_CLIENT=$(aws ec2 describe-security-groups   --group-names group-client-1380   --output json | jq -r .SecurityGroups[0].GroupId)
SG_INTERNAL=$(aws ec2 describe-security-groups --group-names group-internal-1380 --output json | jq -r .SecurityGroups[0].GroupId)

aws ec2 describe-instances --filters "Name=instance.group-id,Values=$SG_CLIENT" --output json \
    | jq '[.Reservations[].Instances[] | {public: .NetworkInterfaces[0].Association.PublicIp, private: .PrivateIpAddress}]' \
    > deploy/client.json

aws ec2 describe-instances --filters "Name=instance.group-id,Values=$SG_INTERNAL" --output json \
    | jq '[.Reservations[].Instances[] | {public: .NetworkInterfaces[0].Association.PublicIp, private: .PrivateIpAddress}]' \
    > deploy/internal.json

run_ssh() {
    ssh -o "UserKnownHostsFile=/dev/null" -o "StrictHostKeyChecking=no" -i deploy/keypair-1380.pem "admin@$1" "$2"
}

# ssh -i keypair-1380.pem "admin@$ip"

for ip in $(jq -nc --argfile internal deploy/internal.json --argfile client deploy/client.json '$internal + $client | .[]'); do
    targetPublic=$(echo "$ip" | jq -r '.public')
    targetPrivate=$(echo "$ip" | jq -r '.private')

    a=$(cat << EOL 
{
    ip: \$targetPrivate,
    port: 8080,
    hostOn: { ip: "0.0.0.0", port: 8080 },
    known: [
        {gid: "client", node: {ip: \$client[0].private, port: 8080}}, 
        {gid: "authoritativeStudents", node: {ip: \$internals[0].private, port: 8080}},
        {gid: "authoritativeCourses", node: {ip: \$internals[0].private, port: 8080}},
        {gid: "students", node: {ip: \$internals[0].private, port: 8080}},
        {gid: "courses", node: {ip: \$internals[0].private, port: 8080}}
    ]
} 
EOL
)

    b=$(jq -n --arg targetPrivate "$targetPrivate" --argfile client deploy/client.json --argfile internals deploy/internal.json "$a")
    known=$(node -e "console.log(require('./backend/distribution/util/serialization.js').serialize($b))")

    run_ssh $targetPublic "sudo apt update && sudo apt install -y nodejs git vim npm && mkdir -p ~/frontend && mkdir -p ~/backend"
    scp -o "UserKnownHostsFile=/dev/null" -o "StrictHostKeyChecking=no" -i deploy/keypair-1380.pem -r  data "admin@$targetPublic:~/"
    scp -o "UserKnownHostsFile=/dev/null" -o "StrictHostKeyChecking=no" -i deploy/keypair-1380.pem -r frontend/static frontend/main.mjs frontend/package.json "admin@$targetPublic:~/frontend"
    scp -o "UserKnownHostsFile=/dev/null" -o "StrictHostKeyChecking=no" -i deploy/keypair-1380.pem -r backend/distribution backend/distribution.js backend/package.json data "admin@$targetPublic:~/backend"
    run_ssh $targetPublic "\
        sudo setcap cap_net_bind_service=+ep \$(which node); \
        pkill node; \
        cd ~/backend; \
        npm install; \
        nohup ./distribution.js --config '$known' >> dist.log 2>&1 & \
        cd ~/frontend; \
        npm install; \
        nohup ./main.mjs >> www.log 2>&1 &"
done
