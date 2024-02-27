// import {app, HttpRequest, HttpResponseInit, InvocationContext, TimerHandler} from "@azure/functions";
// import {Timer} from "@azure/functions/types/timer.js";
//
// export const handler: TimerHandler = async (myTimer: Timer, context: InvocationContext) => {
//     context.log('timer')
//     return {
//         status: 200
//     };
// };
//
// console.log('timer')
//
// app.timer('send', {
//     handler,
//     schedule: '0 * * * * *',
// })