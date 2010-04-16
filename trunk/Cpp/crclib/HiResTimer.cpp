#include "stdafx.h"
#include "HiResTimer.h"

//***********************************************
CHiResTimer::CHiResTimer() : m_qwStart(0), m_qwStop(0)
{
	m_bTimerInstalled = QueryPerformanceFrequency((LARGE_INTEGER*)&m_qwFreq) ? true : false;
}

//***********************************************
void CHiResTimer::Start(void)
{
	QueryPerformanceCounter((LARGE_INTEGER*)&m_qwStart);
}

//***********************************************
void CHiResTimer::Stop(void)
{
	QueryPerformanceCounter((LARGE_INTEGER*)&m_qwStop);
}

//***********************************************
float CHiResTimer::GetTime(void) const
{
	float fTime = 0.0;
	if(m_bTimerInstalled && m_qwFreq != 0)
		fTime = (float)((m_qwStop - m_qwStart) / (float)m_qwFreq);

	return fTime;
}

//***********************************************
void CHiResTimer::Reset(void)
{
	m_qwStart = m_qwStop = 0;
}
