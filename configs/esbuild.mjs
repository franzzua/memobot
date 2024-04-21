import path from "node:path";
import esbuild from "esbuild";

const context = await esbuild.context({
    entryPoints: {
        index: 'dist/esm/index.js'
    },
    bundle: true,
    platform: "node",
    outfile: "./dist/index.cjs",
    target: 'ES2020',
    format: "cjs",
    external: []
});

if (process.argv.includes('--watch')){
    context.watch();
} else {
    await context.rebuild();
    await context.dispose();
}