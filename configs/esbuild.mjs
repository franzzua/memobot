import esbuild from "esbuild";
import pkgJson from "../package.json" with {type: "json"};

const context = await esbuild.context({
    entryPoints: {
        index: 'dist/esm/index.js'
    },
    bundle: true,
    platform: "node",
    outfile: "./dist/index.cjs",
    target: 'ES2020',
    minify: process.argv.includes('--minify'),
    format: "cjs",
    loader: {
        '.node': 'copy',
    },
    alias: {
        'node-fetch': './src/fetch.ts'
    },
    external: Object.keys(pkgJson.dependencies),
});

if (process.argv.includes('--watch')){
    await context.watch();
} else {
    await context.rebuild();
    await context.dispose();
}