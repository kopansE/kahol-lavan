import { colors } from './colors';

export const customChatTheme = {
  messageSimple: {
    content: {
      containerInner: {
        borderRadius: 18,
      },
      textContainer: {
        borderRadius: 18,
      },
    },
  },
  // Other user's messages (left side, white)
  colors: {
    grey_gainsboro: colors.white,
    black: colors.darkGray,
    white: colors.white,
  },
};

// Custom styles for message rendering
export const messageTheme = {
  // Message container styles
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  // Bubble styles for other users (left side)
  leftBubble: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    maxWidth: '70%',
  },
  // Bubble styles for current user (right side)
  rightBubble: {
    backgroundColor: colors.primaryGradientStart,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    padding: 12,
    shadowColor: colors.primaryGradientStart,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 2,
    maxWidth: '70%',
  },
  // Text styles
  leftText: {
    color: colors.darkGray,
    fontSize: 15,
    lineHeight: 22,
  },
  rightText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 22,
  },
  // Timestamp styles
  timestamp: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 4,
  },
};
