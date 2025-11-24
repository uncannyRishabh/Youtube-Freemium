cmake_minimum_required(VERSION 3.10)
project(Freemium)

set(EXTENSION_SRC "src")
set(OUTPUT_DIR "out/Chrome_Edge")
set(DEFAULT_VERSION "LATEST")

option(VERSION "Chrome extension version" "${DEFAULT_VERSION}")

# Construct the output filename
string(REPLACE "." "_" EXTENSION_VERSION_UNDERSCORE "${VERSION}")
set(OUTPUT_ZIP "youtube_freemium_${EXTENSION_VERSION_UNDERSCORE}.zip")
set(FULL_OUTPUT_PATH "${CMAKE_SOURCE_DIR}/${OUTPUT_DIR}/${OUTPUT_ZIP}")

# Ensure the output directory exists
file(MAKE_DIRECTORY "${CMAKE_SOURCE_DIR}/${OUTPUT_DIR}")

add_custom_target(
    extension
    COMMAND ${CMAKE_COMMAND} -E tar cf "${FULL_OUTPUT_PATH}" --format=zip .
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/src
    COMMENT "Packing Chrome extension to ${FULL_OUTPUT_PATH}..."
)

# Custom command to print the completion message
add_custom_command(
    OUTPUT printed_done_message # Dummy output to track completion
    COMMAND ${CMAKE_COMMAND} -E echo "DONE ${FULL_OUTPUT_PATH}"
    DEPENDS extension
    VERBATIM
)

# Create a new custom target that depends on the printing command
add_custom_target(
    package_and_print
    DEPENDS printed_done_message
    COMMENT "Packing and printing completion message"
)