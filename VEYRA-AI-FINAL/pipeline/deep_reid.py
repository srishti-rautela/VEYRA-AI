import numpy as np


visitor_embeddings = {}


def create_embedding(visitor_id):

    # deterministic simulated appearance embedding
    np.random.seed(
        abs(hash(visitor_id)) % (10**6)
    )

    emb = np.random.rand(128)

    return emb / np.linalg.norm(emb)



def cosine_similarity(a,b):

    return float(
        np.dot(a,b)
    )



def match_identity(visitor_id):

    new_embedding = create_embedding(
        visitor_id
    )


    if visitor_id in visitor_embeddings:

        old_embedding = visitor_embeddings[
            visitor_id
        ]

        confidence = cosine_similarity(
            old_embedding,
            new_embedding
        )

    else:

        confidence = np.random.uniform(
            0.86,
            0.97
        )


    visitor_embeddings[
        visitor_id
    ] = new_embedding


    return round(
        confidence,
        2
    )