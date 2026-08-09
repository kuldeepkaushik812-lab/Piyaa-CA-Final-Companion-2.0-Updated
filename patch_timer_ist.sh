#!/bin/bash
sed -i 's/const now = new Date();/const now = getISTDate();/' src/components/StudyTimer.tsx
