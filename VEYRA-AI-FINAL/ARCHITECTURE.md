# 🏗 VEYRA AI Architecture


## Complete Pipeline


```mermaid
flowchart TD


A[Retail CCTV Cameras]


--> B[YOLOv8 Vision Engine]


B --> C[ByteTrack Tracking]


C --> D[Deep ReID]


D --> E[Camera Handoff Engine]


E --> F[Event Intelligence Layer]


F --> G[FastAPI Backend]


G --> H[Metrics Engine]


G --> I[AI Store Manager]


G --> J[Heatmap Intelligence]


G --> K[Report Generator]


H --> L[React Dashboard]


I --> L


J --> L

```


---


## Data Transformation


```
Video Frame

    |

Detection

    |

Person Identity

    |

Customer Behaviour

    |

Business Event

    |

AI Decision

```


---


## Scaling Design


Current:

```
8 Cameras
+
16K Events
```


Production:


```
1000 Stores

        |

Camera Streams

        |

AI Worker Cluster

        |

Event Queue

        |

Analytics Platform

```


---


# System Philosophy


```
Do not store videos.

Understand behaviours.

Generate decisions.
```
