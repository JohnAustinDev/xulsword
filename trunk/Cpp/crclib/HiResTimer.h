#ifndef _HIRESTIMER_H_
#define _HIRESTIMER_H_

#include "Common.h"

class CHiResTimer
{
public:
	CHiResTimer();
	virtual ~CHiResTimer() {}

	bool IsTimerInstalled(void) const {return m_bTimerInstalled;}

	void Start(void);
	void Stop(void);
	float GetTime(void) const;
	void Reset(void);

protected:
	bool m_bTimerInstalled;
	QWORD m_qwStart, m_qwStop, m_qwFreq;
};

#endif
