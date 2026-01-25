# Power Pet - A Tangible VR Companion for Focus, Calm, and Emotional Regulation
Submission for MIT Reality Hack 2026

Power Pet is a tangible XR companion that synchronizes a virtual pet in WebXR with a physical robotic pet using Arduino Uno Q. The system combines browser-based XR, Linux networking, and real-time microcontroller motor control to create a multi-sensory, accessible experience for emotional regulation and productivity.

## System Architecture

Power Pet runs on a **hybrid architecture**:

- WebXR (Meta Quest 3) for interaction and hand tracking (doesn't require users to download apps and allows for fast testing)
- Linux (Arduino Uno Q) for networking and WebSockets
- MCU (Arduino Uno Q) for real-time motor + sensor control
- Physical hardware (servos, stepper, modulinos) for tangible feedback

This allows the pet to exist simultaneously in VR and the real world.

run `sudo lsof -i -P -n | grep LISTEN` and find an adb task, e.g.  
`adb 123 username 18u IPv4 0x8abb123 0t0 TCP 127.0.0.1:7114 (LISTEN)`
