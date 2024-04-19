#!/bin/bash

# run this from the deploy folder

SG_CLIENT=$(aws ec2 describe-security-groups   --group-names group-client-1380   --output json | jq -r .SecurityGroups[0].GroupId)
SG_INTERNAL=$(aws ec2 describe-security-groups --group-names group-internal-1380 --output json | jq -r .SecurityGroups[0].GroupId)

aws ec2 describe-instances --filters "Name=instance.group-id,Values=$SG_CLIENT" --output json \
    | jq '[.Reservations[].Instances[] | {public: .NetworkInterfaces[0].Association.PublicIp, private: .PrivateIpAddress}]' \
    > client.json

aws ec2 describe-instances --filters "Name=instance.group-id,Values=$SG_INTERNAL" --output json \
    | jq '[.Reservations[].Instances[] | {public: .NetworkInterfaces[0].Association.PublicIp, private: .PrivateIpAddress}]' \
    > internal.json

# # gather the ips
# aws ec2 describe-instances --filters "Name=instance.group-id,Values=$SG_CLIENT" --output json \
#     | jq '[.Reservations[].Instances[].NetworkInterfaces[0].Association.PublicIp]' \
# aws ec2 describe-instances --filters "Name=instance.group-id,Values=$SG_CLIENT" --output json \
#     | jq '[.Reservations[].Instances[].PrivateIpAddress]' \
#     > client-private.json
# aws ec2 describe-instances --filters "Name=instance.group-id,Values=$SG_INTERNAL" --output json \
#     | jq '[.Reservations[].Instances[].PrivateIpAddress]' \
#     > internal-private.json
# aws ec2 describe-instances --filters "Name=instance.group-id,Values=$SG_INTERNAL" --output json \
#     | jq '[.Reservations[].Instances[].NetworkInterfaces[0].Association.PublicIp]' \
#     > internal-public.json

run_ssh() {
    ssh -o "UserKnownHostsFile=/dev/null" -o "StrictHostKeyChecking=no" -i keypair-1380.pem "admin@$1" "$2"
}

# ssh -i keypair-1380.pem "admin@$ip"

# no trailing comma allowed

for ip in $(jq -nc --argfile internal internal.json --argfile client client.json '$internal + $client | .[]'); do
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
        {gid: "students", node: {ip: \$internals[1].private, port: 8080}},
        {gid: "courses", node: {ip: \$internals[2].private, port: 8080}},
        {gid: "students", node: {ip: \$internals[3].private, port: 8080}},
        {gid: "courses", node: {ip: \$internals[4].private, port: 8080}}
    ]
} 
EOL
)

    b=$(jq -n --arg targetPrivate "$targetPrivate" --argfile client client.json --argfile internals internal.json "$a")
    known=$(node -e "console.log(require('../distribution/util/serialization.js').serialize($b))")

    #run_ssh $targetPublic "sudo apt update && sudo apt install -y nodejs git vim npm && mkdir -p final && rm -rf final/distribution"
    run_ssh $targetPublic "mkdir -p final && rm -rf final/distribution"
    scp -o "UserKnownHostsFile=/dev/null" -o "StrictHostKeyChecking=no" -i keypair-1380.pem -r ../distribution.js ../distribution ../package.json ../data ../store "admin@$targetPublic:~/final"
#     run_ssh $targetPublic "cd final; npm install; pkill node; nohup ./distribution.js --foo 4 --config '$known' >> log.txt 2>&1 &"
    run_ssh $targetPublic "cd final; pkill node; nohup ./distribution.js --foo 4 --config '$known' >> log.txt 2>&1 &"
done
