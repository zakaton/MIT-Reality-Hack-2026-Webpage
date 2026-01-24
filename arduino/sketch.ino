#include <Arduino_RouterBridge.h>
#include <Servo.h>
#include <AccelStepper.h>

const uint8_t numberOfServos = 2;
Servo servos[numberOfServos];
const uint8_t servoPins[numberOfServos] = {2, 3};
bool shouldUpdateServos[numberOfServos] = {false};
int servoAngles[numberOfServos] = {0};

void setup()
{
    // FILL - setup stepper motors

    for (uint8_t i = 0; i < numberOfServos; i++)
    {
        servos[i].attach(servoPins[i]);
    }

    Bridge.begin();
    Bridge.provide("set_servo_angle", set_servo_angle);
}

volatile int servoTest = 0;
void loop()
{
    if (false)
    {
        for (uint8_t i = 0; i < numberOfServos; i++)
        {
            servos[i].write(servoTest % 90);
        }
        servoTest++;
        delay(30);
    }

    for (uint8_t i = 0; i < numberOfServos; i++)
    {
        if (shouldUpdateServos[i])
        {
            // Monitor.println("shouldUpdateServos");
            servos[i].write(servoAngles[i]);
            shouldUpdateServos[i] = false;
        }
    }
}

void set_servo_angle(int servoIndex, int angle)
{
    // Monitor.print("set_servo_angle #");
    // Monitor.print(servoIndex);
    // Monitor.print(" at angle ");
    // Monitor.print(angle);
    // Monitor.println();

    if (servoIndex >= numberOfServos)
    {
        Monitor.print("invalid servoIndex - max ");
        Monitor.print(numberOfServos - 1);
        Monitor.println();
        return;
    }

    shouldUpdateServos[servoIndex] = true;
    servoAngles[servoIndex] = angle;
}