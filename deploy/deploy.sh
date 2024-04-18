# run this from the deploy folder

SG_CLIENT=$(aws ec2 describe-security-groups   --group-names group-client-1380   | jq -r .SecurityGroups[0].GroupId)
SG_INTERNAL=$(aws ec2 describe-security-groups --group-names group-internal-1380 | jq -r .SecurityGroups[0].GroupId)

# gather the ips
aws ec2 describe-instances --filters "Name=instance.group-id,Values=$SG_CLIENT" \
    | jq -r '.Reservations[].Instances[0].InstanceId' \
    | xargs aws ec2 describe-instances --instance-ids \
    | jq '[.Reservations[].Instances[0].NetworkInterfaces[0].Association.PublicIp]' \
    > client.json

aws ec2 describe-instances --filters "Name=instance.group-id,Values=$SG_INTERNAL" \
    | jq -r '.Reservations[].Instances[0].InstanceId' \
    | xargs aws ec2 describe-instances --instance-ids \
    | jq '[.Reservations[].Instances[0].PrivateIpAddress]' \
    > internal-private.json

aws ec2 describe-instances --filters "Name=instance.group-id,Values=$SG_INTERNAL" \
    | jq -r '.Reservations[].Instances[0].InstanceId' \
    | xargs aws ec2 describe-instances --instance-ids \
    | jq '[.Reservations[].Instances[0].NetworkInterfaces[0].Association.PublicIp]' \
    > internal-public.json

add_group() {
    local ip="$1"
    local gid="$2"
    local ipg="$3"
    local d
    d=$(node -e "console.log(require('../distribution/util/serialization.js').serialize(['$gid', {ip: '$ipg', port: 8080}]))")
    curl -s -X POST "$ip:8080/groups/add" -d "$d"
}

client=$(jq -rn '$client | .[]' --argfile client client.json)
internals=$(jq -rn '$internal | .[]' --argfile internal internal-private.json)
ips=$(jq -rn '$internal + $client | .[]' --argfile internal internal-public.json --argfile client client.json)

for ip in $ips; do
    ssh -i keypair-1380.pem "admin@$ip" 'sudo apt update && sudo apt install -y nodejs git vim npm'
    ssh -i keypair-1380.pem "admin@$ip" 'mkdir -p final && rm -rf final/distribution'
    scp -r -i keypair-1380.pem ../distribution.js ../distribution ../package.json "admin@$ip:~/final"
    ssh -i keypair-1380.pem "admin@$ip" 'cd final; npm install; pkill node; nohup ./distribution.js > /dev/null 2>&1 &'

    add_group "$ip" "client" "$client"

    add_group "$ip" "authoritativeStudents" "${internals[0]}"
    add_group "$ip" "authoritativeCourses" "${internals[0]}"

    add_group "$ip" "students" "${internals[1]}"
    add_group "$ip" "courses" "${internals[2]}"

    add_group "$ip" "students" "${internals[3]}"
    add_group "$ip" "courses" "${internals[4]}"
done
