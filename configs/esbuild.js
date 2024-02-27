import esbuild from "esbuild";
import path from "node:path";

const context = await esbuild.context({
    entryPoints: {
        main: 'src/index.ts'
    },
    bundle: true,
    platform: "node",
    outdir: "./dist",
    target: 'ES2020',
    format: "esm",
    external: [
        "@azure/functions",
        "telegraf"
    ]
});

if (process.argv.includes('--watch')){
    context.watch();
} else {
    await context.rebuild();
    await context.dispose();
}