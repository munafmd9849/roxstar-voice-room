const errorResponse = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string", example: "VALIDATION_ERROR" },
        message: { type: "string", example: "Invalid request" },
        details: {
          type: "array",
          items: {
            type: "object",
            required: ["path", "message", "code"],
            properties: {
              path: { type: "string", example: "name" },
              message: { type: "string", example: "Name is required." },
              code: { type: "string", example: "too_small" }
            }
          }
        }
      }
    }
  }
} as const;

const roomActionResponse = (messages: string[]) => ({
  type: "object",
  required: ["room", "participants", "message"],
  properties: {
    room: { $ref: "#/components/schemas/Room" },
    participants: {
      type: "array",
      items: { $ref: "#/components/schemas/RoomParticipant" }
    },
    message: { type: "string", enum: messages }
  }
});

export const openapiDocument = {
  openapi: "3.0.3",
  info: {
    title: "RoxStar Voice Room API",
    version: "1.0.0",
    description: "REST APIs currently available after Phase 3. Realtime Socket.IO APIs are not documented because they are not implemented."
  },
  servers: [{ url: "http://localhost:3000", description: "Local development" }],
  paths: {
    "/health": {
      get: {
        summary: "Check service health",
        description: "Returns the current backend service health status.",
        responses: {
          "200": {
            description: "Service is healthy.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status", "service"],
                  properties: {
                    status: { type: "string", enum: ["ok"] },
                    service: { type: "string", enum: ["roxstar-backend"] }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/users": {
      post: {
        summary: "Create a user",
        description: "Creates an unauthenticated user for the current development flow.",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateUserRequest" } }
          }
        },
        responses: {
          "201": {
            description: "User created.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } }
          },
          "400": {
            description: "Invalid request body.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          }
        }
      }
    },
    "/api/rooms": {
      post: {
        summary: "Create a room",
        description: "Creates an active room and its owner's active membership atomically.",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateRoomRequest" } }
          }
        },
        responses: {
          "201": {
            description: "Room created.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/RoomState" } } }
          },
          "400": {
            description: "Invalid request body.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          },
          "404": {
            description: "User not found.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          },
          "409": {
            description: "A unique room code could not be generated.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          }
        }
      }
    },
    "/api/rooms/{roomCode}/join": {
      post: {
        summary: "Join a room",
        description: "Adds a user to an active room or reactivates their prior membership without duplicating it.",
        parameters: [
          {
            name: "roomCode",
            in: "path",
            required: true,
            description: "Six-character room code using non-ambiguous characters. Lowercase input is normalized to uppercase.",
            schema: { type: "string", pattern: "^[A-HJ-NP-Za-hj-np-z2-9]{6}$", example: "AB7K9Q" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/JoinRoomRequest" } }
          }
        },
        responses: {
          "200": {
            description: "Current room state after the join operation.",
            content: {
              "application/json": {
                schema: roomActionResponse(["Joined room.", "User is already an active room member."])
              }
            }
          },
          "400": {
            description: "Invalid room code or request body.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          },
          "404": {
            description: "User or room not found.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          },
          "409": {
            description: "Room is closed.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          }
        }
      }
    },
    "/api/rooms/{roomId}/leave": {
      post: {
        summary: "Leave a room",
        description: "Marks a membership as left while preserving its history. Repeating the operation is safe.",
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            description: "Room identifier.",
            schema: { type: "string", minLength: 1, maxLength: 191, example: "cmu3oboyk0001t307ztb5w231" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/LeaveRoomRequest" } }
          }
        },
        responses: {
          "200": {
            description: "Current room state after the leave operation.",
            content: {
              "application/json": {
                schema: roomActionResponse(["Left room.", "User has already left the room."])
              }
            }
          },
          "400": {
            description: "Invalid room ID or request body.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          },
          "404": {
            description: "Room or membership not found.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          }
        }
      }
    },
    "/api/rooms/{roomId}": {
      get: {
        summary: "Get current room state",
        description: "Returns the authoritative room state and its active participants.",
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            description: "Room identifier.",
            schema: { type: "string", minLength: 1, maxLength: 191, example: "cmu3oboyk0001t307ztb5w231" }
          }
        ],
        responses: {
          "200": {
            description: "Current room state.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/RoomState" } } }
          },
          "400": {
            description: "Invalid room ID.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          },
          "404": {
            description: "Room not found.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      User: {
        type: "object",
        required: ["id", "name", "createdAt"],
        properties: {
          id: { type: "string", example: "cmu3obify0000t307ex1cg9yi" },
          name: { type: "string", example: "Munaf" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      CreateUserRequest: {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string", minLength: 1, maxLength: 100, example: "Munaf" } }
      },
      Room: {
        type: "object",
        required: ["id", "code", "ownerId", "status", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", example: "cmu3oboyk0001t307ztb5w231" },
          code: { type: "string", pattern: "^[A-HJ-NP-Z2-9]{6}$", example: "AB7K9Q" },
          ownerId: { type: "string", example: "cmu3obify0000t307ex1cg9yi" },
          status: { type: "string", enum: ["ACTIVE", "CLOSED"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      CreateRoomRequest: {
        type: "object",
        required: ["userId"],
        properties: { userId: { type: "string", minLength: 1, maxLength: 191 } }
      },
      JoinRoomRequest: {
        type: "object",
        required: ["userId"],
        properties: { userId: { type: "string", minLength: 1, maxLength: 191 } }
      },
      LeaveRoomRequest: {
        type: "object",
        required: ["userId"],
        properties: { userId: { type: "string", minLength: 1, maxLength: 191 } }
      },
      RoomParticipant: {
        type: "object",
        required: ["userId", "name", "status"],
        properties: {
          userId: { type: "string", example: "cmu3obify0000t307ex1cg9yi" },
          name: { type: "string", example: "Munaf" },
          status: { type: "string", enum: ["ACTIVE"] }
        }
      },
      RoomState: {
        type: "object",
        required: ["room", "participants"],
        properties: {
          room: { $ref: "#/components/schemas/Room" },
          participants: {
            type: "array",
            items: { $ref: "#/components/schemas/RoomParticipant" }
          }
        }
      },
      ErrorResponse: errorResponse
    }
  }
} as const;
