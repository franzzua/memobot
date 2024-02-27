import path from "node:path";
import esbuild from "esbuild";

const context = await esbuild.context({
    entryPoints: {
        index: 'src/index.ts'
    },
    bundle: true,
    platform: "node",
    outdir: "./dist",
    target: 'ES2020',
    format: "cjs",
    external: ['crypto']
});

if (process.argv.includes('--watch')){
    context.watch();
} else {
    await context.rebuild();
    await context.dispose();
}