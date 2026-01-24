# SPDX-FileCopyrightText: Copyright (C) ARDUINO SRL (http://www.arduino.cc)
#
# SPDX-License-Identifier: MPL-2.0

from arduino.app_utils import *
from arduino.app_bricks.web_ui import WebUI


def set_servo_angle(client, data):
    # print("set_servo_angle")
    # print(data)

    Bridge.call("set_servo_angle", data["index"], data["angle"])
    # ui.send_message('did_set_servo_angle', {"hello": "world"})


# Initialize WebUI
ui = WebUI()

# Handle socket messages (like in Code Scanner example)
ui.on_message("set_servo_angle", set_servo_angle)

# Start the application
App.run()
