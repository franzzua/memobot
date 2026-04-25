import data from "./sat_tests.json" with {type: "json"};

for (let item of data){
    if(!item.addition) continue;
    item.addition = new Buffer(item.addition, 'base64url').toString();
}

