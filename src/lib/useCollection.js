import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";

/**
 * Souscrit en temps réel à une query/collection Firestore.
 * Retourne { data, loading, error }. `data` est toujours un tableau (jamais null).
 */
export function useCollection(query) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    const unsub = onSnapshot(
      query,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [query]);

  return { data, loading, error };
}
