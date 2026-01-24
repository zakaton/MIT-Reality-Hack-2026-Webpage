# SPDX-FileCopyrightText: Copyright (C) ARDUINO SRL (http://www.arduino.cc)
#
# SPDX-License-Identifier: MPL-2.0

from arduino.app_utils import *
from arduino.app_bricks.web_ui import WebUI

angles = {"servos": [], "steppers": []}


def set_at_index(lst, index, value, fill=0):
    if index >= len(lst):
        lst.extend([fill] * (index + 1 - len(lst)))
    lst[index] = value


def set_servo_angle(client, data):
    # print("set_servo_angle")
    # print(data)

    Bridge.call("set_servo_angle", data["index"], data["angle"])
    set_at_index(angles["servos"], data["index"], data["angle"])
    ui.send_message("get_angles", angles)


def set_stepper_angle(client, data):
    # print("set_stepper_angle")
    # print(data)

    Bridge.call("set_stepper_angle", data["angle"])
    set_at_index(angles["steppers"], 0, data["angle"])
    ui.send_message("get_angles", angles)


def get_angles(client, data):
    print("get_angles")
    # print(data)

    ui.send_message("get_angles", angles, client)


# Initialize WebUI
ui = WebUI()

# Handle socket messages (like in Code Scanner example)
ui.on_message("set_servo_angle", set_servo_angle)
ui.on_message("set_stepper_angle", set_stepper_angle)
ui.on_message("get_angles", get_angles)

# Start the application
App.run()
