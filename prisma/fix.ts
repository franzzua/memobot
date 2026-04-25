import sat from "../sat_tests.json" with {type: "json"};
import satImage from "../sat_tests_image.json"  with {type: "json"};
import * as fs from "node:fs";

const imageMap = new Map(satImage.filter(d => d.addition.startsWith('data:image')).map(x => [x.index, x.addition]));

for (let data of sat){
    data.image = imageMap.get(data.index);
}

await fs.promises.writeFile("./sat_tests.json", JSON.stringify(sat, null, '  '), 'utf-8');