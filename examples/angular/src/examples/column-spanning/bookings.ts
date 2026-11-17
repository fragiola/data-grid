import { hash } from "../_kit/data";

// The day's bookings, made up from each room's index: the same room, the same day. App data: the
// grid only asks each hour's column how many hours its cell spans.

/** The first hour shown, and how many follow it. */
export const FIRST_HOUR = 8;
export const HOURS = 12;

const TITLES = [
    "Standup",
    "Design review",
    "Interviews",
    "Planning",
    "Workshop",
    "1:1",
    "Customer call",
    "Retrospective",
    "Training",
];

export interface Booking {
    /** the hour it starts at (8 to 19) */
    start: number;
    /** how many hours it takes */
    hours: number;
    title: string;
}

export interface Room {
    id: number;
    name: string;
    /** in the order they start, never overlapping */
    bookings: Booking[];
    /** the hours booked */
    booked: number;
}

/** The room at `index`, and its bookings through the day. */
function room(index: number): Room {
    const bookings: Booking[] = [];
    let hour = FIRST_HOUR;
    for (let step = 0; hour < FIRST_HOUR + HOURS; step++) {
        const seed = index * 31 + step;
        // a free hour now and then
        if (hash(seed, 3) === 0) {
            hour += 1;
            continue;
        }
        const hours = Math.min(
            1 + hash(seed + 7, 4),
            FIRST_HOUR + HOURS - hour,
        );
        bookings.push({
            start: hour,
            hours,
            title: TITLES[hash(seed + 13, TITLES.length)] ?? "Meeting",
        });
        hour += hours;
    }
    const floor = 1 + Math.floor(index / 8);
    return {
        id: index + 1,
        name: `Room ${floor}.${String((index % 8) + 1).padStart(2, "0")}`,
        bookings,
        booked: bookings.reduce((sum, booking) => sum + booking.hours, 0),
    };
}

export const rooms: Room[] = Array.from({ length: 64 }, (_, index) =>
    room(index),
);

/** The booking a room has starting at `hour`, if any. */
export function bookingAt(row: Room, hour: number): Booking | undefined {
    return row.bookings.find((booking) => booking.start === hour);
}

/** `9` → `09:00`. */
export function time(hour: number): string {
    return `${String(hour).padStart(2, "0")}:00`;
}
