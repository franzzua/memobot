export const TimeMock = {
    date: new Date(),
    move(to: Date){
        this.date = to;
    }
}