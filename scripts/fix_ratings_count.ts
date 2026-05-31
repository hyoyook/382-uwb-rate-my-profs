// scripts/fix_ratings_count.ts
import { adminDb } from '../lib/firebaseAdmin';

async function fix() {
    const professors = await adminDb.collection('professors').get();

    for (const prof of professors.docs) {
        const reviews = await adminDb.collection('reviews')
            .where('professor_id', '==', prof.id)
            .get();

        const count = reviews.size;
        const avg = count > 0
            ? reviews.docs.reduce((sum: number, r) => sum + r.data().scores.overall, 0) / count
            : 0;

        await prof.ref.update({
            ratings_count: count,
            overall_rating: Math.round(avg * 10) / 10,
        });

        console.log(`${prof.data().name}: ${count} reviews, avg ${avg.toFixed(1)}`);
    }

    console.log('Done.');
}

fix();